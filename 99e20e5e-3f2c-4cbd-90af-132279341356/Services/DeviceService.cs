using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Device;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace FireIoTPlatform.Services;

public class DeviceService : IDeviceService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRedisCacheService _cache;
    private readonly IHubContext<FireAlarmHub> _hubContext;
    private readonly ILogger<DeviceService> _logger;
    private readonly IDeviceDataShardingService _shardingService;

    public DeviceService(IUnitOfWork unitOfWork, IRedisCacheService cache,
        IHubContext<FireAlarmHub> hubContext, ILogger<DeviceService> logger,
        IDeviceDataShardingService shardingService)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _hubContext = hubContext;
        _logger = logger;
        _shardingService = shardingService;
    }

    public async Task<ApiResponse<DeviceDto>> GetByIdAsync(long id)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(id);
        if (device == null)
            return ApiResponse<DeviceDto>.Error(404, "设备不存在");

        var dto = await MapToDtoAsync(device);
        return ApiResponse<DeviceDto>.Success(dto);
    }

    public async Task<ApiResponse<PagedResult<DeviceDto>>> GetPagedAsync(DeviceQueryDto query)
    {
        var predicate = PredicateBuilder.True<Device>();
        predicate = predicate.And(d => !d.IsDeleted);

        if (query.DeviceType.HasValue)
            predicate = predicate.And(d => d.DeviceType == query.DeviceType.Value);
        if (query.Status.HasValue)
            predicate = predicate.And(d => d.Status == query.Status.Value);
        if (query.FireUnitId.HasValue)
            predicate = predicate.And(d => d.FireUnitId == query.FireUnitId.Value);
        if (query.IsEnabled.HasValue)
            predicate = predicate.And(d => d.IsEnabled == query.IsEnabled.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(d => d.DeviceCode.Contains(query.Keyword) || d.DeviceName.Contains(query.Keyword));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = await _unitOfWork.FireUnits
                .FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode);
            var ids = unitIds.Select(u => u.Id).ToList();
            if (ids.Any())
                predicate = predicate.And(d => ids.Contains(d.FireUnitId));
            else
                return ApiResponse<PagedResult<DeviceDto>>.Success(new PagedResult<DeviceDto>
                { PageIndex = query.PageIndex, PageSize = query.PageSize });
        }

        var result = await _unitOfWork.Devices.GetPagedAsync(predicate, query.PageIndex, query.PageSize,
            d => d.CreatedAt, query.IsDescending);

        var dtos = new List<DeviceDto>();
        foreach (var device in result.Items)
            dtos.Add(await MapToDtoAsync(device));

        return ApiResponse<PagedResult<DeviceDto>>.Success(new PagedResult<DeviceDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize
        });
    }

    public async Task<ApiResponse<DeviceDto>> CreateAsync(DeviceCreateDto dto)
    {
        if (await _unitOfWork.Devices.ExistsAsync(d => d.DeviceCode == dto.DeviceCode && !d.IsDeleted))
            return ApiResponse<DeviceDto>.Error(400, "设备编码已存在");

        var device = new Device
        {
            DeviceCode = dto.DeviceCode,
            DeviceName = dto.DeviceName,
            DeviceType = dto.DeviceType,
            Manufacturer = dto.Manufacturer,
            Model = dto.Model,
            ProductionDate = dto.ProductionDate,
            InstallationDate = dto.InstallationDate,
            FireUnitId = dto.FireUnitId,
            Location = dto.Location,
            Floor = dto.Floor,
            Room = dto.Room,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            WarningThresholdLow = dto.WarningThresholdLow,
            WarningThresholdHigh = dto.WarningThresholdHigh,
            CriticalThresholdLow = dto.CriticalThresholdLow,
            CriticalThresholdHigh = dto.CriticalThresholdHigh,
            Description = dto.Description,
            Status = DeviceStatus.Offline,
            IsEnabled = true
        };

        device.AuthToken = GenerateToken();

        await _unitOfWork.Devices.AddAsync(device);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<DeviceDto>.Success("创建成功", await MapToDtoAsync(device));
    }

    public async Task<ApiResponse<bool>> UpdateAsync(long id, DeviceUpdateDto dto)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(id);
        if (device == null || device.IsDeleted)
            return ApiResponse<bool>.Error(404, "设备不存在");

        if (!string.IsNullOrEmpty(dto.DeviceName)) device.DeviceName = dto.DeviceName;
        if (!string.IsNullOrEmpty(dto.Location)) device.Location = dto.Location;
        if (!string.IsNullOrEmpty(dto.Floor)) device.Floor = dto.Floor;
        if (!string.IsNullOrEmpty(dto.Room)) device.Room = dto.Room;
        if (dto.Latitude.HasValue) device.Latitude = dto.Latitude.Value;
        if (dto.Longitude.HasValue) device.Longitude = dto.Longitude.Value;
        if (dto.WarningThresholdLow.HasValue) device.WarningThresholdLow = dto.WarningThresholdLow.Value;
        if (dto.WarningThresholdHigh.HasValue) device.WarningThresholdHigh = dto.WarningThresholdHigh.Value;
        if (dto.CriticalThresholdLow.HasValue) device.CriticalThresholdLow = dto.CriticalThresholdLow.Value;
        if (dto.CriticalThresholdHigh.HasValue) device.CriticalThresholdHigh = dto.CriticalThresholdHigh.Value;
        if (!string.IsNullOrEmpty(dto.Description)) device.Description = dto.Description;
        if (dto.IsEnabled.HasValue) device.IsEnabled = dto.IsEnabled.Value;

        _unitOfWork.Devices.Update(device);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteAsync(long id)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(id);
        if (device == null || device.IsDeleted)
            return ApiResponse<bool>.Error(404, "设备不存在");

        device.IsDeleted = true;
        _unitOfWork.Devices.Update(device);
        await _unitOfWork.SaveChangesAsync();

        await _cache.RemoveAsync($"device:status:{id}");
        await _cache.RemoveAsync($"device:heartbeat:{id}");

        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<bool>> ReportDataAsync(DeviceDataReportDto dto)
    {
        var device = await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == dto.DeviceCode && !d.IsDeleted);
        if (device == null)
            return ApiResponse<bool>.Error(404, "设备不存在");
        if (!device.IsEnabled)
            return ApiResponse<bool>.Error(400, "设备已禁用");
        if (!string.IsNullOrEmpty(device.AuthToken) && device.AuthToken != dto.Token)
            return ApiResponse<bool>.Error(401, "认证失败");

        var status = dto.Status ?? device.Status;
        var now = DateTime.Now;

        var deviceData = new DeviceData
        {
            DeviceId = device.Id,
            FireUnitId = device.FireUnitId,
            DeviceType = device.DeviceType,
            Value = dto.Value,
            RawData = dto.RawData,
            Status = status,
            Timestamp = dto.Timestamp,
            Year = dto.Timestamp.Year,
            Month = dto.Timestamp.Month,
            Day = dto.Timestamp.Day,
            Hour = dto.Timestamp.Hour
        };
        await _unitOfWork.DeviceDatas.AddAsync(deviceData);

        var oldStatus = device.Status;
        device.Status = status;
        device.LastHeartbeatAt = now;
        if (status == DeviceStatus.Alarm)
            device.LastAlarmAt = now;
        _unitOfWork.Devices.Update(device);

        await _cache.SetDeviceStatusAsync(device.Id, new
        {
            device.Id,
            device.DeviceCode,
            Status = status,
            dto.Value,
            Timestamp = now,
            device.FireUnitId
        });
        await _cache.SetDeviceHeartbeatAsync(device.Id, now);

        await _unitOfWork.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            try
            {
                await _shardingService.InsertDeviceDataAsync(deviceData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"写入设备数据分表失败: DeviceId={device.Id}");
            }
        });

        if (oldStatus != status)
        {
            await _hubContext.Clients.Group($"unit_{device.FireUnitId}").SendAsync("DeviceStatusChanged", new DeviceStatusDto
            {
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                Status = status,
                Value = dto.Value,
                Timestamp = now,
                FireUnitId = device.FireUnitId
            });
            await _hubContext.Clients.All.SendAsync("DeviceStatusChanged", new DeviceStatusDto
            {
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                Status = status,
                Value = dto.Value,
                Timestamp = now,
                FireUnitId = device.FireUnitId
            });
        }

        if (status == DeviceStatus.Alarm || CheckThreshold(device, dto.Value))
        {
            _logger.LogInformation($"设备告警触发: DeviceCode={dto.DeviceCode}, Status={status}, Value={dto.Value}");
        }

        return ApiResponse<bool>.Success(true);
    }

    public async Task<ApiResponse<bool>> ReportHeartbeatAsync(DeviceHeartbeatDto dto)
    {
        var device = await _unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == dto.DeviceCode && !d.IsDeleted);
        if (device == null)
            return ApiResponse<bool>.Error(404, "设备不存在");
        if (!string.IsNullOrEmpty(device.AuthToken) && device.AuthToken != dto.Token)
            return ApiResponse<bool>.Error(401, "认证失败");

        var now = DateTime.Now;
        var newStatus = dto.Status ?? DeviceStatus.Online;
        var oldStatus = device.Status;

        if (device.Status == DeviceStatus.Offline)
            device.Status = newStatus;
        else if (dto.Status.HasValue)
            device.Status = dto.Status.Value;

        device.LastHeartbeatAt = now;
        _unitOfWork.Devices.Update(device);

        await _cache.SetDeviceStatusAsync(device.Id, new
        {
            device.Id,
            device.DeviceCode,
            Status = device.Status,
            Timestamp = now,
            device.FireUnitId
        });
        await _cache.SetDeviceHeartbeatAsync(device.Id, now);

        await _unitOfWork.SaveChangesAsync();

        if (oldStatus != device.Status)
        {
            await _hubContext.Clients.Group($"unit_{device.FireUnitId}").SendAsync("DeviceStatusChanged", new DeviceStatusDto
            {
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                Status = device.Status,
                Timestamp = now,
                FireUnitId = device.FireUnitId
            });
        }

        return ApiResponse<bool>.Success(true);
    }

    public async Task<ApiResponse<DeviceDashboardStatsDto>> GetDashboardStatsAsync(long? fireUnitId = null, string? districtCode = null)
    {
        var predicate = PredicateBuilder.True<Device>().And(d => !d.IsDeleted);
        if (fireUnitId.HasValue)
            predicate = predicate.And(d => d.FireUnitId == fireUnitId.Value);
        if (!string.IsNullOrEmpty(districtCode))
        {
            var unitIds = await _unitOfWork.FireUnits
                .FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode);
            var ids = unitIds.Select(u => u.Id).ToList();
            predicate = predicate.And(d => ids.Contains(d.FireUnitId));
        }

        var allDevices = await _unitOfWork.Devices.FindAsync(predicate);
        var stats = new DeviceDashboardStatsDto
        {
            TotalCount = allDevices.Count(),
            OnlineCount = allDevices.Count(d => d.Status == DeviceStatus.Online),
            OfflineCount = allDevices.Count(d => d.Status == DeviceStatus.Offline),
            FaultCount = allDevices.Count(d => d.Status == DeviceStatus.Fault),
            AlarmCount = allDevices.Count(d => d.Status == DeviceStatus.Alarm)
        };
        stats.OnlineRate = stats.TotalCount > 0 ? Math.Round((double)stats.OnlineCount / stats.TotalCount * 100, 2) : 0;

        return ApiResponse<DeviceDashboardStatsDto>.Success(stats);
    }

    public async Task<ApiResponse<List<DeviceStatusDto>>> GetRealTimeStatusAsync(long? fireUnitId = null)
    {
        var predicate = PredicateBuilder.True<Device>().And(d => !d.IsDeleted);
        if (fireUnitId.HasValue)
            predicate = predicate.And(d => d.FireUnitId == fireUnitId.Value);

        var devices = await _unitOfWork.Devices.FindAsync(predicate);
        var result = new List<DeviceStatusDto>();

        foreach (var device in devices)
        {
            var cachedStatus = await _cache.GetDeviceStatusAsync(device.Id);
            result.Add(new DeviceStatusDto
            {
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                Status = device.Status,
                Timestamp = device.LastHeartbeatAt ?? device.CreatedAt
            });
        }

        return ApiResponse<List<DeviceStatusDto>>.Success(result);
    }

    public async Task<ApiResponse<bool>> BatchSetEnabledAsync(List<long> ids, bool enabled)
    {
        var devices = await _unitOfWork.Devices.FindAsync(d => ids.Contains(d.Id) && !d.IsDeleted);
        foreach (var device in devices)
        {
            device.IsEnabled = enabled;
            _unitOfWork.Devices.Update(device);
        }
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success($"{(enabled ? "启用" : "禁用")}成功", true);
    }

    public async Task<ApiResponse<string>> GenerateAuthTokenAsync(long deviceId)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
        if (device == null || device.IsDeleted)
            return ApiResponse<string>.Error(404, "设备不存在");

        device.AuthToken = GenerateToken();
        _unitOfWork.Devices.Update(device);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<string>.Success(device.AuthToken);
    }

    private async Task<DeviceDto> MapToDtoAsync(Device device)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(device.FireUnitId);
        return new DeviceDto
        {
            Id = device.Id,
            DeviceCode = device.DeviceCode,
            DeviceName = device.DeviceName,
            DeviceType = device.DeviceType,
            DeviceTypeName = GetDeviceTypeName(device.DeviceType),
            Status = device.Status,
            StatusName = GetDeviceStatusName(device.Status),
            Manufacturer = device.Manufacturer,
            Model = device.Model,
            FireUnitId = device.FireUnitId,
            FireUnitName = unit?.Name,
            Location = device.Location,
            Floor = device.Floor,
            Room = device.Room,
            LastHeartbeatAt = device.LastHeartbeatAt,
            LastAlarmAt = device.LastAlarmAt,
            IsEnabled = device.IsEnabled,
            CreatedAt = device.CreatedAt
        };
    }

    private static string GetDeviceTypeName(DeviceType type) => type switch
    {
        DeviceType.SmokeDetector => "独立烟感",
        DeviceType.TemperatureDetector => "温感探测器",
        DeviceType.WaterPressureMonitor => "消防水压监测",
        DeviceType.HydrantStatusMonitor => "消防栓状态监测",
        DeviceType.ElectricalFireMonitor => "电气火灾监控",
        DeviceType.WaterLevelMonitor => "水位监测",
        _ => "未知"
    };

    private static string GetDeviceStatusName(DeviceStatus status) => status switch
    {
        DeviceStatus.Online => "在线",
        DeviceStatus.Offline => "离线",
        DeviceStatus.Fault => "故障",
        DeviceStatus.Alarm => "告警",
        DeviceStatus.Maintenance => "维护中",
        _ => "未知"
    };

    private static bool CheckThreshold(Device device, decimal? value)
    {
        if (!value.HasValue) return false;
        if (device.WarningThresholdLow.HasValue && value < device.WarningThresholdLow.Value) return true;
        if (device.WarningThresholdHigh.HasValue && value > device.WarningThresholdHigh.Value) return true;
        if (device.CriticalThresholdLow.HasValue && value < device.CriticalThresholdLow.Value) return true;
        if (device.CriticalThresholdHigh.HasValue && value > device.CriticalThresholdHigh.Value) return true;
        return false;
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray()).Replace("=", "").Replace("+", "").Replace("/", "");
    }
}

public static class PredicateBuilder
{
    public static System.Linq.Expressions.Expression<Func<T, bool>> True<T>() { return f => true; }
    public static System.Linq.Expressions.Expression<Func<T, bool>> False<T>() { return f => false; }

    public static System.Linq.Expressions.Expression<Func<T, bool>> And<T>(
        this System.Linq.Expressions.Expression<Func<T, bool>> expr1,
        System.Linq.Expressions.Expression<Func<T, bool>> expr2)
    {
        var invokedExpr = System.Linq.Expressions.Expression.Invoke(expr2, expr1.Parameters);
        return System.Linq.Expressions.Expression.Lambda<Func<T, bool>>(
            System.Linq.Expressions.Expression.AndAlso(expr1.Body, invokedExpr), expr1.Parameters);
    }
}
