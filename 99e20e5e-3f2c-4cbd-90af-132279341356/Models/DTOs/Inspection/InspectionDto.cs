using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Inspection;

public class InspectionTaskDto
{
    public long Id { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public string? TaskName { get; set; }
    public DeviceType? DeviceType { get; set; }
    public InspectionStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime PlanStartDate { get; set; }
    public DateTime PlanEndDate { get; set; }
    public DateTime? ActualStartDate { get; set; }
    public DateTime? ActualEndDate { get; set; }
    public long? InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public int? CycleDays { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InspectionTaskCreateDto
{
    public long FireUnitId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public DeviceType? DeviceType { get; set; }
    public DateTime PlanStartDate { get; set; }
    public DateTime PlanEndDate { get; set; }
    public long? InspectorId { get; set; }
    public int? CycleDays { get; set; }
    public string? CheckItems { get; set; }
    public string? Description { get; set; }
    public bool IsRecurring { get; set; } = false;
    public string? RecurringRule { get; set; }
}

public class InspectionTaskQueryDto : PagedQuery
{
    public InspectionStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public long? InspectorId { get; set; }
    public string? DistrictCode { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class InspectionRecordDto
{
    public long Id { get; set; }
    public long InspectionTaskId { get; set; }
    public long? DeviceId { get; set; }
    public string? DeviceCode { get; set; }
    public string? Location { get; set; }
    public DateTime CheckInTime { get; set; }
    public string? QrCode { get; set; }
    public string? CheckResult { get; set; }
    public bool IsNormal { get; set; }
    public string? Remark { get; set; }
    public string? Photos { get; set; }
    public long InspectorId { get; set; }
    public string? InspectorName { get; set; }
}

public class InspectionRecordCreateDto
{
    public long InspectionTaskId { get; set; }
    public long? DeviceId { get; set; }
    public string? Location { get; set; }
    public decimal? CheckInLatitude { get; set; }
    public decimal? CheckInLongitude { get; set; }
    public string? QrCode { get; set; }
    public string? CheckItems { get; set; }
    public string? CheckResult { get; set; }
    public bool IsNormal { get; set; } = true;
    public string? Remark { get; set; }
    public string? Photos { get; set; }
    public long InspectorId { get; set; }
}

public class HazardRecordDto
{
    public long Id { get; set; }
    public string HazardNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public long? InspectionTaskId { get; set; }
    public HazardLevel Level { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public HazardStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Photos { get; set; }
    public DateTime DiscoverTime { get; set; }
    public DateTime Deadline { get; set; }
    public DateTime? RectifyTime { get; set; }
    public DateTime? AcceptTime { get; set; }
    public string? DiscovererName { get; set; }
    public string? RectifierName { get; set; }
    public string? RectifyPlan { get; set; }
    public string? RectifyResult { get; set; }
    public int EscalationLevel { get; set; }
    public bool IsOverdue { get; set; }
}

public class HazardRecordCreateDto
{
    public long FireUnitId { get; set; }
    public long? InspectionTaskId { get; set; }
    public HazardLevel Level { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Photos { get; set; }
    public DateTime Deadline { get; set; }
    public long DiscovererId { get; set; }
    public long? RectifierId { get; set; }
    public string? RectifyPlan { get; set; }
}

public class HazardQueryDto : PagedQuery
{
    public HazardLevel? Level { get; set; }
    public HazardStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsOverdue { get; set; }
}

public class HazardRectifyDto
{
    public long HazardId { get; set; }
    public string RectifyResult { get; set; } = string.Empty;
    public string? Photos { get; set; }
    public long RectifierId { get; set; }
}

public class HazardAcceptDto
{
    public long HazardId { get; set; }
    public bool IsAccepted { get; set; }
    public string AcceptRemark { get; set; } = string.Empty;
    public long AcceptorId { get; set; }
}

public class InspectionStatisticsDto
{
    public int TotalTaskCount { get; set; }
    public int CompletedTaskCount { get; set; }
    public int OverdueTaskCount { get; set; }
    public double CompletionRate { get; set; }
    public int TotalHazardCount { get; set; }
    public int PendingHazardCount { get; set; }
    public int ResolvedHazardCount { get; set; }
    public int OverdueHazardCount { get; set; }
}
