using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class HazardRecord : BaseEntity
{
    public string HazardNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public long? InspectionTaskId { get; set; }
    public long? InspectionRecordId { get; set; }
    public HazardLevel Level { get; set; } = HazardLevel.General;
    public HazardStatus Status { get; set; } = HazardStatus.Registered;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Photos { get; set; }
    public DateTime DiscoverTime { get; set; }
    public DateTime Deadline { get; set; }
    public DateTime? RectifyTime { get; set; }
    public DateTime? AcceptTime { get; set; }
    public long? DiscovererId { get; set; }
    public string? DiscovererName { get; set; }
    public long? RectifierId { get; set; }
    public string? RectifierName { get; set; }
    public long? AcceptorId { get; set; }
    public string? AcceptorName { get; set; }
    public string? RectifyPlan { get; set; }
    public string? RectifyResult { get; set; }
    public string? AcceptRemark { get; set; }
    public int EscalationLevel { get; set; } = 0;
    public bool IsOverdue { get; set; } = false;

    public FireUnit? FireUnit { get; set; }
    public InspectionTask? InspectionTask { get; set; }
}
