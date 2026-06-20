using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Alarm;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Hubs;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;

namespace FireIoTPlatform.Services;

public class AlarmService : IAlarmService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRedisCacheService _cache;
    private readonly IHubContext<FireAlarmHub> _hubContext;
    private readonly ILogger<AlarmService> _logger;
    private readonly IConfiguration _config;

    public AlarmService(IUnitOfWork unitOfWork, IRedisCacheService cache,
        IHubContext<FireAlarmHub> hubContext, ILogger<AlarmService> logger, IConfiguration config)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _hubContext = hubContext;
        _logger = logger;
        _config = config;
    }

    public async Task<ApiResponse<AlarmRecordDto>> GetByIdAsync(long id)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(id);
        if (alarm == null)
            return ApiResponse<AlarmRecordDto>.Error(404, "告警记录不存在");

        return ApiResponse<AlarmRecordDto>.Success(await MapToDtoAsync(alarm));
    }

    public async Task<ApiResponse<PagedResult<AlarmRecordDto>>> GetPagedAsync(AlarmQueryDto query)
    {
        var predicate = PredicateBuilder.True<AlarmRecord>().And(a => !a.IsDeleted);

        if (query.AlarmType.HasValue) predicate = predicate.And(a => a.AlarmType == query.AlarmType.Value);
        if (query.AlarmLevel.HasValue) predicate = predicate.And(a => a.AlarmLevel == query.AlarmLevel.Value);
        if (query.Status.HasValue) predicate = predicate.And(a => a.Status == query.Status.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(a => a.FireUnitId == query.FireUnitId.Value);
        if (query.DeviceId.HasValue) predicate = predicate.And(a => a.DeviceId == query.DeviceId.Value);
        if (query.StartTime.HasValue) predicate = predicate.And(a => a.AlarmTime >= query.StartTime.Value);
        if (query.EndTime.HasValue) predicate = predicate.And(a => a.AlarmTime <= query.EndTime.Value);
        if (query.IsFalseAlarm.HasValue) predicate = predicate.And(a => a.IsFalseAlarm == query.IsFalseAlarm.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(a => a.AlarmNo.Contains(query.Keyword) || (a.Description != null && a.Description.Contains(query.Keyword)));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(a => unitIds.Contains(a.FireUnitId));
            else return ApiResponse<PagedResult<AlarmRecordDto>>.Success(new PagedResult<AlarmRecordDto> { PageIndex = query.PageIndex, PageSize = query.PageSize });
        }

        var result = await _unitOfWork.AlarmRecords.GetPagedAsync(predicate, query.PageIndex, query.PageSize,
            a => a.AlarmTime, query.IsDescending);

        var dtos = new List<AlarmRecordDto>();
        foreach (var alarm in result.Items) dtos.Add(await MapToDtoAsync(alarm));

        return ApiResponse<PagedResult<AlarmRecordDto>>.Success(new PagedResult<AlarmRecordDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize
        });
    }

    public async Task<ApiResponse<AlarmRecordDto>> CreateAlarmAsync(long deviceId, string description, decimal? alarmValue = null)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
        if (device == null || device.IsDeleted)
            return ApiResponse<AlarmRecordDto>.Error(404, "设备不存在");

        var alarmType = MapDeviceTypeToAlarmType(device.DeviceType);
        var alarmLevel = DetermineAlarmLevel(device, alarmValue);

        var alarm = new AlarmRecord
        {
            AlarmNo = GenerateAlarmNo(),
            DeviceId = deviceId,
            FireUnitId = device.FireUnitId,
            AlarmType = alarmType,
            AlarmLevel = alarmLevel,
            Status = AlarmStatus.Pending,
            Description = description,
            AlarmValue = alarmValue,
            ThresholdValue = device.WarningThresholdHigh ?? device.CriticalThresholdHigh,
            Location = device.Location,
            Floor = device.Floor,
            Room = device.Room,
            AlarmTime = DateTime.Now,
            SnapshotData = JsonConvert.SerializeObject(new { device.Status, device.DeviceType, device.WarningThresholdHigh, device.CriticalThresholdHigh })
        };

        await _unitOfWork.AlarmRecords.AddAsync(alarm);

        device.Status = DeviceStatus.Alarm;
        device.LastAlarmAt = alarm.AlarmTime;
        _unitOfWork.Devices.Update(device);

        await _unitOfWork.SaveChangesAsync();

        var dto = await MapToDtoAsync(alarm);
        await _hubContext.Clients.Group($"unit_{device.FireUnitId}").SendAsync("NewAlarm", dto);
        await _hubContext.Clients.All.SendAsync("NewAlarm", dto);

        _logger.LogInformation($"告警已创建: AlarmNo={alarm.AlarmNo}, DeviceId={deviceId}, Level={alarmLevel}");

        return ApiResponse<AlarmRecordDto>.Success("告警创建成功", dto);
    }

    public async Task<ApiResponse<bool>> ConfirmAlarmAsync(AlarmConfirmDto dto)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(dto.AlarmId);
        if (alarm == null || alarm.IsDeleted)
            return ApiResponse<bool>.Error(404, "告警不存在");
        if (alarm.Status != AlarmStatus.Pending)
            return ApiResponse<bool>.Error(400, "告警状态不允许确认");

        alarm.Status = dto.IsFalseAlarm ? AlarmStatus.FalseAlarm : AlarmStatus.Confirmed;
        alarm.IsFalseAlarm = dto.IsFalseAlarm;
        alarm.ConfirmTime = DateTime.Now;
        alarm.ConfirmedBy = dto.OperatorId;
        alarm.ConfirmRemark = dto.Remark;

        _unitOfWork.AlarmRecords.Update(alarm);
        await _unitOfWork.SaveChangesAsync();

        var dtoAlarm = await MapToDtoAsync(alarm);
        await _hubContext.Clients.Group($"unit_{alarm.FireUnitId}").SendAsync("AlarmUpdated", dtoAlarm);
        await _hubContext.Clients.All.SendAsync("AlarmUpdated", dtoAlarm);

        return ApiResponse<bool>.Success("确认成功", true);
    }

    public async Task<ApiResponse<bool>> ProcessAlarmAsync(AlarmProcessDto dto)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(dto.AlarmId);
        if (alarm == null || alarm.IsDeleted)
            return ApiResponse<bool>.Error(404, "告警不存在");
        if (alarm.Status is not (AlarmStatus.Pending or AlarmStatus.Confirmed))
            return ApiResponse<bool>.Error(400, "告警状态不允许处理");

        alarm.Status = AlarmStatus.Processing;
        alarm.ProcessTime = DateTime.Now;
        alarm.ProcessedBy = dto.OperatorId;
        alarm.ProcessRemark = dto.Remark;

        _unitOfWork.AlarmRecords.Update(alarm);
        await _unitOfWork.SaveChangesAsync();

        var dtoAlarm = await MapToDtoAsync(alarm);
        await _hubContext.Clients.Group($"unit_{alarm.FireUnitId}").SendAsync("AlarmUpdated", dtoAlarm);

        return ApiResponse<bool>.Success("处理成功", true);
    }

    public async Task<ApiResponse<bool>> ResolveAlarmAsync(AlarmResolveDto dto)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(dto.AlarmId);
        if (alarm == null || alarm.IsDeleted)
            return ApiResponse<bool>.Error(404, "告警不存在");
        if (alarm.Status is not (AlarmStatus.Processing or AlarmStatus.Confirmed))
            return ApiResponse<bool>.Error(400, "告警状态不允许解除");

        alarm.Status = AlarmStatus.Resolved;
        alarm.ResolveTime = DateTime.Now;
        alarm.ResolvedBy = dto.OperatorId;
        alarm.ResolveRemark = dto.Remark;

        _unitOfWork.AlarmRecords.Update(alarm);

        var device = await _unitOfWork.Devices.GetByIdAsync(alarm.DeviceId);
        if (device != null && device.Status == DeviceStatus.Alarm)
        {
            device.Status = DeviceStatus.Online;
            _unitOfWork.Devices.Update(device);
        }

        await _unitOfWork.SaveChangesAsync();

        var dtoAlarm = await MapToDtoAsync(alarm);
        await _hubContext.Clients.Group($"unit_{alarm.FireUnitId}").SendAsync("AlarmUpdated", dtoAlarm);

        return ApiResponse<bool>.Success("解除成功", true);
    }

    public async Task<ApiResponse<FireIntelligenceDto>> GetFireIntelligenceAsync(long alarmId)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(alarmId);
        if (alarm == null)
            return ApiResponse<FireIntelligenceDto>.Error(404, "告警不存在");

        var unit = await _unitOfWork.FireUnits.GetByIdAsync(alarm.FireUnitId);
        var multiDeviceWindow = int.TryParse(_config["AlarmSettings:MultiDeviceAlarmWindowSeconds"], out var w) ? w : 30;
        var multiDeviceCount = int.TryParse(_config["AlarmSettings:MultiDeviceAlarmCount"], out var c) ? c : 2;

        var startTime = alarm.AlarmTime.AddSeconds(-multiDeviceWindow);
        var endTime = alarm.AlarmTime.AddSeconds(multiDeviceWindow);

        var relatedAlarms = await _unitOfWork.AlarmRecords.FindAsync(a =>
            a.FireUnitId == alarm.FireUnitId &&
            a.Id != alarm.Id &&
            a.AlarmTime >= startTime &&
            a.AlarmTime <= endTime &&
            !a.IsDeleted);

        var alarmDtos = new List<AlarmRecordDto> { await MapToDtoAsync(alarm) };
        foreach (var a in relatedAlarms) alarmDtos.Add(await MapToDtoAsync(a));

        var isMultiDevice = alarmDtos.Count >= multiDeviceCount;
        var confirmedLevel = isMultiDevice ? AlarmLevel.Emergency : alarm.AlarmLevel;

        var result = new FireIntelligenceDto
        {
            FireUnitId = alarm.FireUnitId,
            FireUnitName = unit?.Name ?? "",
            Address = unit?.Address,
            Latitude = unit?.Latitude,
            Longitude = unit?.Longitude,
            RelatedAlarms = alarmDtos,
            IsMultiDeviceAlarm = isMultiDevice,
            RelatedDeviceCount = alarmDtos.Count,
            ConfirmedLevel = confirmedLevel,
            AutoDispatch = isMultiDevice || confirmedLevel >= AlarmLevel.Critical,
            OccurTime = alarm.AlarmTime,
            BuildingInfo = unit != null ? $"建筑面积:{unit.BuildingArea}㎡, 楼层:{unit.FloorCount}层, 地下:{unit.BasementCount}层" : null,
            FloorPlanUrl = unit?.FloorPlanUrl,
            HazardousMaterials = unit?.HazardousMaterials
        };

        return ApiResponse<FireIntelligenceDto>.Success(result);
    }

    public async Task<ApiResponse<AlarmStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null,
        string? districtCode = null, DateTime? startTime = null, DateTime? endTime = null)
    {
        var predicate = PredicateBuilder.True<AlarmRecord>().And(a => !a.IsDeleted);
        if (fireUnitId.HasValue) predicate = predicate.And(a => a.FireUnitId == fireUnitId.Value);
        if (startTime.HasValue) predicate = predicate.And(a => a.AlarmTime >= startTime.Value);
        if (endTime.HasValue) predicate = predicate.And(a => a.AlarmTime <= endTime.Value);

        if (!string.IsNullOrEmpty(districtCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(a => unitIds.Contains(a.FireUnitId));
        }

        var alarms = await _unitOfWork.AlarmRecords.FindAsync(predicate);
        var stats = new AlarmStatisticsDto
        {
            TotalCount = alarms.Count(),
            PendingCount = alarms.Count(a => a.Status == AlarmStatus.Pending),
            ProcessingCount = alarms.Count(a => a.Status == AlarmStatus.Processing),
            ResolvedCount = alarms.Count(a => a.Status == AlarmStatus.Resolved),
            FalseAlarmCount = alarms.Count(a => a.IsFalseAlarm),
            FalseAlarmRate = alarms.Any() ? Math.Round((double)alarms.Count(a => a.IsFalseAlarm) / alarms.Count() * 100, 2) : 0
        };

        var resolved = alarms.Where(a => a.ConfirmTime.HasValue && a.AlarmTime < a.ConfirmTime).ToList();
        if (resolved.Any())
        {
            stats.AverageResponseSeconds = Math.Round(resolved.Average(a => (a.ConfirmTime!.Value - a.AlarmTime).TotalSeconds), 0);
        }

        var fullyResolved = alarms.Where(a => a.ResolveTime.HasValue && a.AlarmTime < a.ResolveTime).ToList();
        if (fullyResolved.Any())
        {
            stats.AverageResolveMinutes = Math.Round(fullyResolved.Average(a => (a.ResolveTime!.Value - a.AlarmTime).TotalMinutes), 1);
        }

        return ApiResponse<AlarmStatisticsDto>.Success(stats);
    }

    public async Task ProcessDeviceAlarmAsync(long deviceId)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
        if (device == null || device.IsDeleted) return;

        var pendingAlarm = await _unitOfWork.AlarmRecords.FirstOrDefaultAsync(a =>
            a.DeviceId == deviceId && a.Status == AlarmStatus.Pending && !a.IsDeleted);

        if (pendingAlarm != null) return;

        await CreateAlarmAsync(deviceId, GetAlarmDescription(device.DeviceType));
    }

    public async Task AggregateAlarmsAsync()
    {
        var multiDeviceWindow = int.TryParse(_config["AlarmSettings:MultiDeviceAlarmWindowSeconds"], out var w) ? w : 30;
        var multiDeviceCount = int.TryParse(_config["AlarmSettings:MultiDeviceAlarmCount"], out var c) ? c : 2;

        var pendingAlarms = await _unitOfWork.AlarmRecords.FindAsync(a =>
            a.Status == AlarmStatus.Pending && !a.IsMultiDevice && !a.IsDeleted);

        var groupedByUnit = pendingAlarms.GroupBy(a => a.FireUnitId);

        foreach (var group in groupedByUnit)
        {
            var unitAlarms = group.OrderBy(a => a.AlarmTime).ToList();
            for (int i = 0; i < unitAlarms.Count; i++)
            {
                var current = unitAlarms[i];
                var windowStart = current.AlarmTime.AddSeconds(-multiDeviceWindow);
                var windowEnd = current.AlarmTime.AddSeconds(multiDeviceWindow);

                var sameWindowAlarms = unitAlarms.Where(a =>
                    a.AlarmTime >= windowStart && a.AlarmTime <= windowEnd && a.Id != current.Id).ToList();

                if (sameWindowAlarms.Count + 1 >= multiDeviceCount && !current.IsMultiDevice)
                {
                    current.IsMultiDevice = true;
                    current.AlarmLevel = AlarmLevel.Emergency;
                    current.RelatedAlarmIds = string.Join(",", sameWindowAlarms.Select(a => a.Id));
                    _unitOfWork.AlarmRecords.Update(current);

                    foreach (var related in sameWindowAlarms)
                    {
                        if (!related.IsMultiDevice)
                        {
                            related.IsMultiDevice = true;
                            related.AlarmLevel = AlarmLevel.Emergency;
                            related.RelatedAlarmIds = current.Id.ToString();
                            _unitOfWork.AlarmRecords.Update(related);
                        }
                    }

                    _logger.LogInformation($"多设备告警聚合: FireUnitId={group.Key}, AlarmIds={current.Id},{string.Join(",", sameWindowAlarms.Select(a => a.Id))}");

                    var intelligence = await GetFireIntelligenceAsync(current.Id);
                    if (intelligence.Code == 200 && intelligence.Data != null)
                    {
                        await _hubContext.Clients.All.SendAsync("FireIntelligenceAlert", intelligence.Data);
                    }
                }
            }
        }

        await _unitOfWork.SaveChangesAsync();
    }

    private async Task<AlarmRecordDto> MapToDtoAsync(AlarmRecord alarm)
    {
        var device = await _unitOfWork.Devices.GetByIdAsync(alarm.DeviceId);
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(alarm.FireUnitId);

        return new AlarmRecordDto
        {
            Id = alarm.Id,
            AlarmNo = alarm.AlarmNo,
            DeviceId = alarm.DeviceId,
            DeviceCode = device?.DeviceCode,
            DeviceName = device?.DeviceName,
            FireUnitId = alarm.FireUnitId,
            FireUnitName = unit?.Name,
            AlarmType = alarm.AlarmType,
            AlarmTypeName = GetAlarmTypeName(alarm.AlarmType),
            AlarmLevel = alarm.AlarmLevel,
            AlarmLevelName = GetAlarmLevelName(alarm.AlarmLevel),
            Status = alarm.Status,
            StatusName = GetAlarmStatusName(alarm.Status),
            Description = alarm.Description,
            AlarmValue = alarm.AlarmValue,
            ThresholdValue = alarm.ThresholdValue,
            Location = alarm.Location,
            Floor = alarm.Floor,
            AlarmTime = alarm.AlarmTime,
            ConfirmTime = alarm.ConfirmTime,
            ProcessTime = alarm.ProcessTime,
            ResolveTime = alarm.ResolveTime,
            IsFalseAlarm = alarm.IsFalseAlarm,
            IsMultiDevice = alarm.IsMultiDevice,
            DispatchId = alarm.DispatchId,
            CreatedAt = alarm.CreatedAt
        };
    }

    private static AlarmType MapDeviceTypeToAlarmType(DeviceType deviceType) => deviceType switch
    {
        DeviceType.SmokeDetector => AlarmType.SmokeAlarm,
        DeviceType.TemperatureDetector => AlarmType.TemperatureAlarm,
        DeviceType.WaterPressureMonitor => AlarmType.WaterPressureLow,
        DeviceType.WaterLevelMonitor => AlarmType.WaterLevelLow,
        DeviceType.ElectricalFireMonitor => AlarmType.ElectricalFire,
        DeviceType.HydrantStatusMonitor => AlarmType.HydrantAbnormal,
        _ => AlarmType.DeviceFault
    };

    private static AlarmLevel DetermineAlarmLevel(Device device, decimal? value)
    {
        if (!value.HasValue) return AlarmLevel.Warning;
        if ((device.CriticalThresholdLow.HasValue && value <= device.CriticalThresholdLow.Value) ||
            (device.CriticalThresholdHigh.HasValue && value >= device.CriticalThresholdHigh.Value))
            return AlarmLevel.Emergency;
        if ((device.WarningThresholdLow.HasValue && value <= device.WarningThresholdLow.Value) ||
            (device.WarningThresholdHigh.HasValue && value >= device.WarningThresholdHigh.Value))
            return AlarmLevel.Critical;
        return AlarmLevel.Warning;
    }

    private static string GetAlarmTypeName(AlarmType type) => type switch
    {
        AlarmType.SmokeAlarm => "烟雾报警",
        AlarmType.TemperatureAlarm => "温度报警",
        AlarmType.WaterPressureLow => "水压过低",
        AlarmType.WaterLevelLow => "水位过低",
        AlarmType.DeviceOffline => "设备离线",
        AlarmType.DeviceFault => "设备故障",
        AlarmType.ElectricalFire => "电气火灾",
        AlarmType.HydrantAbnormal => "消防栓异常",
        _ => "未知"
    };

    private static string GetAlarmLevelName(AlarmLevel level) => level switch
    {
        AlarmLevel.Info => "提示",
        AlarmLevel.Warning => "警告",
        AlarmLevel.Critical => "严重",
        AlarmLevel.Emergency => "紧急",
        _ => "未知"
    };

    private static string GetAlarmStatusName(AlarmStatus status) => status switch
    {
        AlarmStatus.Pending => "待确认",
        AlarmStatus.Confirmed => "已确认",
        AlarmStatus.Processing => "处理中",
        AlarmStatus.Resolved => "已解除",
        AlarmStatus.FalseAlarm => "误报",
        _ => "未知"
    };

    private static string GetAlarmDescription(DeviceType type) => type switch
    {
        DeviceType.SmokeDetector => "烟雾浓度超标",
        DeviceType.TemperatureDetector => "温度异常升高",
        DeviceType.WaterPressureMonitor => "消防水压低于阈值",
        DeviceType.WaterLevelMonitor => "消防水池水位低于阈值",
        DeviceType.ElectricalFireMonitor => "电气线路异常",
        DeviceType.HydrantStatusMonitor => "消防栓状态异常",
        _ => "设备异常告警"
    };

    private static string GenerateAlarmNo()
    {
        return $"ALM{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
    }
}
