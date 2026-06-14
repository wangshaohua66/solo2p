using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.DTOs;

public class DeviceDto
{
    public string Id { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty;
    public DeviceStatus Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public string? VehicleId { get; set; }
    public string? VehiclePlate { get; set; }
    public double BatteryLevel { get; set; }
    public string? FirmwareVersion { get; set; }
    public DateTime? LastReportAt { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int OfflineThresholdMinutes { get; set; }
    public double LowBatteryThreshold { get; set; }
    public DateTime? InstalledAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsOnline { get; set; }
}

public class CreateDeviceRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = "TemperatureHumiditySensor";
    public string? VehicleId { get; set; }
    public string? VehiclePlate { get; set; }
    public string? FirmwareVersion { get; set; }
    public int OfflineThresholdMinutes { get; set; } = 10;
    public double LowBatteryThreshold { get; set; } = 20.0;
}

public class UpdateDeviceRequest
{
    public string? DeviceName { get; set; }
    public string? VehicleId { get; set; }
    public string? VehiclePlate { get; set; }
    public DeviceStatus? Status { get; set; }
    public int? OfflineThresholdMinutes { get; set; }
    public double? LowBatteryThreshold { get; set; }
    public string? FirmwareVersion { get; set; }
}

public class DeviceQueryRequest : CursorPagedQuery
{
    public DeviceStatus? Status { get; set; }
    public string? Keyword { get; set; }
    public string? VehicleId { get; set; }
    public bool? IsOnline { get; set; }
    public string? DeviceType { get; set; }
}

public class BindDeviceVehicleRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string VehicleId { get; set; } = string.Empty;
    public string VehiclePlate { get; set; } = string.Empty;
}

public class DeviceStatusStatsDto
{
    public int Total { get; set; }
    public int Active { get; set; }
    public int Offline { get; set; }
    public int LowBattery { get; set; }
    public int Inactive { get; set; }
    public int Faulty { get; set; }
}
