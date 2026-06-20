using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Alarm;

public class AlarmRecordDto
{
    public long Id { get; set; }
    public string AlarmNo { get; set; } = string.Empty;
    public long DeviceId { get; set; }
    public string? DeviceCode { get; set; }
    public string? DeviceName { get; set; }
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public AlarmType AlarmType { get; set; }
    public string AlarmTypeName { get; set; } = string.Empty;
    public AlarmLevel AlarmLevel { get; set; }
    public string AlarmLevelName { get; set; } = string.Empty;
    public AlarmStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? AlarmValue { get; set; }
    public decimal? ThresholdValue { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public DateTime AlarmTime { get; set; }
    public DateTime? ConfirmTime { get; set; }
    public DateTime? ProcessTime { get; set; }
    public DateTime? ResolveTime { get; set; }
    public bool IsFalseAlarm { get; set; }
    public bool IsMultiDevice { get; set; }
    public long? DispatchId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AlarmQueryDto : PagedQuery
{
    public AlarmType? AlarmType { get; set; }
    public AlarmLevel? AlarmLevel { get; set; }
    public AlarmStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public long? DeviceId { get; set; }
    public string? DistrictCode { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public bool? IsFalseAlarm { get; set; }
}

public class AlarmConfirmDto
{
    public long AlarmId { get; set; }
    public bool IsFalseAlarm { get; set; }
    public string? Remark { get; set; }
    public long OperatorId { get; set; }
}

public class AlarmProcessDto
{
    public long AlarmId { get; set; }
    public string? Remark { get; set; }
    public long OperatorId { get; set; }
}

public class AlarmResolveDto
{
    public long AlarmId { get; set; }
    public string Remark { get; set; } = string.Empty;
    public long OperatorId { get; set; }
}

public class AlarmStatisticsDto
{
    public int TotalCount { get; set; }
    public int PendingCount { get; set; }
    public int ProcessingCount { get; set; }
    public int ResolvedCount { get; set; }
    public int FalseAlarmCount { get; set; }
    public double FalseAlarmRate { get; set; }
    public double AverageResponseSeconds { get; set; }
    public double AverageResolveMinutes { get; set; }
}

public class FireIntelligenceDto
{
    public long FireUnitId { get; set; }
    public string FireUnitName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public List<AlarmRecordDto> RelatedAlarms { get; set; } = new();
    public bool IsMultiDeviceAlarm { get; set; }
    public int RelatedDeviceCount { get; set; }
    public AlarmLevel ConfirmedLevel { get; set; }
    public bool AutoDispatch { get; set; }
    public DateTime OccurTime { get; set; }
    public string? BuildingInfo { get; set; }
    public string? FloorPlanUrl { get; set; }
    public string? HazardousMaterials { get; set; }
    public string? NearbyWaterSources { get; set; }
}
