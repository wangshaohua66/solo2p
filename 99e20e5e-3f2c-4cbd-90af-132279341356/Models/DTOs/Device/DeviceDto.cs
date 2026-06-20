using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Device;

public class DeviceDto
{
    public long Id { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public string DeviceTypeName { get; set; } = string.Empty;
    public DeviceStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public DateTime? LastAlarmAt { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DeviceCreateDto
{
    public string DeviceCode { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? InstallationDate { get; set; }
    public long FireUnitId { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? WarningThresholdLow { get; set; }
    public decimal? WarningThresholdHigh { get; set; }
    public decimal? CriticalThresholdLow { get; set; }
    public decimal? CriticalThresholdHigh { get; set; }
    public string? Description { get; set; }
}

public class DeviceUpdateDto
{
    public string? DeviceName { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? WarningThresholdLow { get; set; }
    public decimal? WarningThresholdHigh { get; set; }
    public decimal? CriticalThresholdLow { get; set; }
    public decimal? CriticalThresholdHigh { get; set; }
    public string? Description { get; set; }
    public bool? IsEnabled { get; set; }
}

public class DeviceQueryDto : PagedQuery
{
    public DeviceType? DeviceType { get; set; }
    public DeviceStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsEnabled { get; set; }
}

public class DeviceStatusDto
{
    public long DeviceId { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public DeviceStatus Status { get; set; }
    public decimal? Value { get; set; }
    public DateTime Timestamp { get; set; }
    public long FireUnitId { get; set; }
}

public class DeviceDataReportDto
{
    public string DeviceCode { get; set; } = string.Empty;
    public string? Token { get; set; }
    public decimal? Value { get; set; }
    public DeviceStatus? Status { get; set; }
    public string? RawData { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

public class DeviceHeartbeatDto
{
    public string DeviceCode { get; set; } = string.Empty;
    public string? Token { get; set; }
    public DeviceStatus? Status { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

public class DeviceDashboardStatsDto
{
    public int TotalCount { get; set; }
    public int OnlineCount { get; set; }
    public int OfflineCount { get; set; }
    public int FaultCount { get; set; }
    public int AlarmCount { get; set; }
    public double OnlineRate { get; set; }
}
