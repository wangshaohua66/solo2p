using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class InspectionTask : BaseEntity
{
    public string TaskNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public string? TaskName { get; set; }
    public DeviceType? DeviceType { get; set; }
    public InspectionStatus Status { get; set; } = InspectionStatus.Pending;
    public DateTime PlanStartDate { get; set; }
    public DateTime PlanEndDate { get; set; }
    public DateTime? ActualStartDate { get; set; }
    public DateTime? ActualEndDate { get; set; }
    public long? InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public int? CycleDays { get; set; }
    public string? CheckItems { get; set; }
    public string? Description { get; set; }
    public bool IsRecurring { get; set; } = false;
    public string? RecurringRule { get; set; }

    public FireUnit? FireUnit { get; set; }
    public ICollection<InspectionRecord> InspectionRecords { get; set; } = new List<InspectionRecord>();
    public ICollection<HazardRecord> Hazards { get; set; } = new List<HazardRecord>();
}
