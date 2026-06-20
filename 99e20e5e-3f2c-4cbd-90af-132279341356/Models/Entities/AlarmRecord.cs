using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class AlarmRecord : BaseEntity
{
    public string AlarmNo { get; set; } = string.Empty;
    public long DeviceId { get; set; }
    public long FireUnitId { get; set; }
    public AlarmType AlarmType { get; set; }
    public AlarmLevel AlarmLevel { get; set; }
    public AlarmStatus Status { get; set; } = AlarmStatus.Pending;
    public string? Description { get; set; }
    public decimal? AlarmValue { get; set; }
    public decimal? ThresholdValue { get; set; }
    public string? Location { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public DateTime AlarmTime { get; set; }
    public DateTime? ConfirmTime { get; set; }
    public DateTime? ProcessTime { get; set; }
    public DateTime? ResolveTime { get; set; }
    public long? ConfirmedBy { get; set; }
    public long? ProcessedBy { get; set; }
    public long? ResolvedBy { get; set; }
    public string? ConfirmRemark { get; set; }
    public string? ProcessRemark { get; set; }
    public string? ResolveRemark { get; set; }
    public bool IsFalseAlarm { get; set; }
    public bool IsMultiDevice { get; set; }
    public string? RelatedAlarmIds { get; set; }
    public long? DispatchId { get; set; }
    public string? SnapshotData { get; set; }

    public Device? Device { get; set; }
    public FireUnit? FireUnit { get; set; }
    public RescueDispatch? Dispatch { get; set; }
}
