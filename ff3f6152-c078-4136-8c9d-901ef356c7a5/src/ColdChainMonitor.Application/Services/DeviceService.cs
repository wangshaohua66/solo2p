using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class DeviceService
{
    private readonly IDeviceRepository _deviceRepository;
    private readonly IAuditLogRepository _auditLogRepository;

    public DeviceService(IDeviceRepository deviceRepository, IAuditLogRepository auditLogRepository)
    {
        _deviceRepository = deviceRepository;
        _auditLogRepository = auditLogRepository;
    }

    public async Task<DeviceDto?> GetByIdAsync(string id)
    {
        var device = await _deviceRepository.GetByIdAsync(id);
        return device == null ? null : MapToDto(device);
    }

    public async Task<DeviceDto?> GetByDeviceIdAsync(string deviceId)
    {
        var device = await _deviceRepository.GetByDeviceIdAsync(deviceId);
        return device == null ? null : MapToDto(device);
    }

    public async Task<CursorPagedResult<DeviceDto>> GetPagedAsync(DeviceQueryRequest request)
    {
        var result = await _deviceRepository.GetPagedAsync(
            request.Status,
            request.Keyword,
            request.VehicleId,
            request.DeviceType,
            request.Cursor,
            request.Limit,
            request.SortDesc);

        return new CursorPagedResult<DeviceDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<DeviceDto> CreateAsync(CreateDeviceRequest request, string operatorId, string operatorName)
    {
        var existing = await _deviceRepository.GetByDeviceIdAsync(request.DeviceId);
        if (existing != null)
            throw new InvalidOperationException("设备编号已存在");

        var device = new Device
        {
            DeviceId = request.DeviceId,
            DeviceName = request.DeviceName,
            DeviceType = request.DeviceType,
            Status = DeviceStatus.Inactive,
            VehicleId = request.VehicleId,
            VehiclePlate = request.VehiclePlate,
            FirmwareVersion = request.FirmwareVersion,
            OfflineThresholdMinutes = request.OfflineThresholdMinutes,
            LowBatteryThreshold = request.LowBatteryThreshold,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _deviceRepository.AddAsync(device);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Create,
            ActionName = "创建设备",
            Module = "Device",
            EntityType = "Device",
            EntityId = device.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(device);
    }

    public async Task<DeviceDto?> UpdateAsync(string id, UpdateDeviceRequest request, string operatorId, string operatorName)
    {
        var device = await _deviceRepository.GetByIdAsync(id);
        if (device == null) return null;

        var oldValue = System.Text.Json.JsonSerializer.Serialize(device);

        if (!string.IsNullOrEmpty(request.DeviceName))
            device.DeviceName = request.DeviceName;
        if (request.VehicleId != null)
            device.VehicleId = request.VehicleId;
        if (request.VehiclePlate != null)
            device.VehiclePlate = request.VehiclePlate;
        if (request.Status.HasValue)
            device.Status = request.Status.Value;
        if (request.OfflineThresholdMinutes.HasValue)
            device.OfflineThresholdMinutes = request.OfflineThresholdMinutes.Value;
        if (request.LowBatteryThreshold.HasValue)
            device.LowBatteryThreshold = request.LowBatteryThreshold.Value;
        if (request.FirmwareVersion != null)
            device.FirmwareVersion = request.FirmwareVersion;

        device.UpdatedAt = DateTime.UtcNow;
        await _deviceRepository.UpdateAsync(id, device);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "更新设备",
            Module = "Device",
            EntityType = "Device",
            EntityId = device.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OldValue = oldValue,
            NewValue = System.Text.Json.JsonSerializer.Serialize(device),
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(device);
    }

    public async Task<bool> DeleteAsync(string id, string operatorId, string operatorName)
    {
        var device = await _deviceRepository.GetByIdAsync(id);
        if (device == null) return false;

        await _deviceRepository.DeleteAsync(id);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Delete,
            ActionName = "删除设备",
            Module = "Device",
            EntityType = "Device",
            EntityId = id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return true;
    }

    public async Task<bool> BindVehicleAsync(BindDeviceVehicleRequest request, string operatorId, string operatorName)
    {
        var device = await _deviceRepository.GetByDeviceIdAsync(request.DeviceId);
        if (device == null) return false;

        device.VehicleId = request.VehicleId;
        device.VehiclePlate = request.VehiclePlate;
        device.UpdatedAt = DateTime.UtcNow;

        await _deviceRepository.UpdateAsync(device.Id, device);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "设备绑定车辆",
            Module = "Device",
            EntityType = "Device",
            EntityId = device.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return true;
    }

    public async Task<DeviceStatusStatsDto> GetStatusStatsAsync()
    {
        var stats = await _deviceRepository.GetStatusStatsAsync();
        return new DeviceStatusStatsDto
        {
            Total = stats.total,
            Active = stats.active,
            Offline = stats.offline,
            LowBattery = stats.lowBattery,
            Inactive = stats.inactive,
            Faulty = stats.faulty
        };
    }

    public async Task<List<DeviceDto>> GetByVehicleIdAsync(string vehicleId)
    {
        var devices = await _deviceRepository.GetByVehicleIdAsync(vehicleId);
        return devices.Select(MapToDto).ToList();
    }

    private static DeviceDto MapToDto(Device device)
    {
        var isOnline = device.LastReportAt.HasValue &&
                       device.Status == DeviceStatus.Active &&
                       (DateTime.UtcNow - device.LastReportAt.Value).TotalMinutes <= device.OfflineThresholdMinutes;

        return new DeviceDto
        {
            Id = device.Id,
            DeviceId = device.DeviceId,
            DeviceName = device.DeviceName,
            DeviceType = device.DeviceType,
            Status = device.Status,
            StatusText = GetStatusText(device.Status),
            VehicleId = device.VehicleId,
            VehiclePlate = device.VehiclePlate,
            BatteryLevel = device.BatteryLevel,
            FirmwareVersion = device.FirmwareVersion,
            LastReportAt = device.LastReportAt,
            Latitude = device.LastKnownLocation?.Latitude,
            Longitude = device.LastKnownLocation?.Longitude,
            OfflineThresholdMinutes = device.OfflineThresholdMinutes,
            LowBatteryThreshold = device.LowBatteryThreshold,
            InstalledAt = device.InstalledAt,
            CreatedAt = device.CreatedAt,
            UpdatedAt = device.UpdatedAt,
            IsOnline = isOnline
        };
    }

    private static string GetStatusText(DeviceStatus status)
    {
        return status switch
        {
            DeviceStatus.Inactive => "未激活",
            DeviceStatus.Active => "在线",
            DeviceStatus.Offline => "离线",
            DeviceStatus.LowBattery => "低电量",
            DeviceStatus.Faulty => "故障",
            _ => "未知"
        };
    }
}
