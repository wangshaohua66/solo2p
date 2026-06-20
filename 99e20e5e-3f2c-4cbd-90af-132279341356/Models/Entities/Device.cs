using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class Device : BaseEntity
{
    public string DeviceCode { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public DeviceStatus Status { get; set; } = DeviceStatus.Offline;
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? FirmwareVersion { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? InstallationDate { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public long FireUnitId { get; set; }
    public string? MqttClientId { get; set; }
    public string? AuthToken { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public DateTime? LastAlarmAt { get; set; }
    public string? IpAddress { get; set; }
    public int HeartbeatInterval { get; set; } = 30;
    public decimal? WarningThresholdLow { get; set; }
    public decimal? WarningThresholdHigh { get; set; }
    public decimal? CriticalThresholdLow { get; set; }
    public decimal? CriticalThresholdHigh { get; set; }
    public string? Description { get; set; }
    public bool IsEnabled { get; set; } = true;

    public FireUnit? FireUnit { get; set; }
    public ICollection<DeviceData> DeviceDatas { get; set; } = new List<DeviceData>();
    public ICollection<AlarmRecord> AlarmRecords { get; set; } = new List<AlarmRecord>();
}
