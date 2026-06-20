using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class WorkOrder : BaseEntity
{
    public string OrderNo { get; set; } = string.Empty;
    public string? SourceType { get; set; }
    public long? SourceId { get; set; }
    public long FireUnitId { get; set; }
    public long? DeviceId { get; set; }
    public long? AlarmId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public HazardLevel Priority { get; set; } = HazardLevel.General;
    public HazardStatus Status { get; set; } = HazardStatus.Registered;
    public string? AssignedTo { get; set; }
    public long? AssignedToId { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime Deadline { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Resolution { get; set; }
    public string? Photos { get; set; }
    public string? Remark { get; set; }
    public bool IsOverdue { get; set; } = false;
    public int EscalationLevel { get; set; } = 0;

    public FireUnit? FireUnit { get; set; }
    public Device? Device { get; set; }
    public AlarmRecord? Alarm { get; set; }
}
