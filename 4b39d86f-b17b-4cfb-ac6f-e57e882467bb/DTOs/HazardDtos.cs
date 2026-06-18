namespace HazChemSupervision.DTOs;

public class HazardRectificationDto
{
    public int Id { get; set; }
    public string WorkOrderNo { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int Source { get; set; }
    public string SourceName { get; set; } = string.Empty;
    public string HazardDescription { get; set; } = string.Empty;
    public int Level { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public string ResponsiblePerson { get; set; } = string.Empty;
    public string ResponsiblePersonPhone { get; set; } = string.Empty;
    public int? ResponsiblePersonId { get; set; }
    public DateTime DiscoveryTime { get; set; }
    public DateTime Deadline { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? AcceptanceCriteria { get; set; }
    public string? RectificationMeasures { get; set; }
    public DateTime? RectificationStartTime { get; set; }
    public DateTime? RectificationCompleteTime { get; set; }
    public string? RectificationResult { get; set; }
    public string? RectificationAttachmentUrl { get; set; }
    public int? InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public DateTime? InspectionTime { get; set; }
    public bool? InspectionPassed { get; set; }
    public string? InspectionComment { get; set; }
    public bool IsEscalated { get; set; }
    public int EscalationLevel { get; set; }
    public DateTime? EscalationTime { get; set; }
    public string? EscalationReason { get; set; }
    public int OverdueDays { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class HazardRectificationCreateDto
{
    public string WorkOrderNo { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public int Source { get; set; }
    public string HazardDescription { get; set; } = string.Empty;
    public int Level { get; set; }
    public string ResponsiblePerson { get; set; } = string.Empty;
    public string ResponsiblePersonPhone { get; set; } = string.Empty;
    public int? ResponsiblePersonId { get; set; }
    public DateTime DiscoveryTime { get; set; }
    public DateTime Deadline { get; set; }
    public string AcceptanceCriteria { get; set; } = string.Empty;
}

public class HazardRectificationStartDto
{
    public string RectificationMeasures { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
}

public class HazardRectificationCompleteDto
{
    public string RectificationResult { get; set; } = string.Empty;
    public DateTime CompleteTime { get; set; }
    public string? AttachmentUrl { get; set; }
}

public class HazardRectificationInspectionDto
{
    public int InspectorId { get; set; }
    public string InspectorName { get; set; } = string.Empty;
    public bool InspectionPassed { get; set; }
    public string InspectionComment { get; set; } = string.Empty;
    public DateTime InspectionTime { get; set; }
}

public class HazardRectificationQueryDto : PagedRequest
{
    public string? WorkOrderNo { get; set; }
    public int? EnterpriseId { get; set; }
    public int? Source { get; set; }
    public int? Level { get; set; }
    public int? Status { get; set; }
    public bool? IsEscalated { get; set; }
    public bool? IsOverdue { get; set; }
    public DateRangeFilter? DiscoveryDateRange { get; set; }
    public DateRangeFilter? DeadlineRange { get; set; }
}

public class HazardStatisticsDto
{
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int TotalCount { get; set; }
    public int PendingCount { get; set; }
    public int InProgressCount { get; set; }
    public int CompletedCount { get; set; }
    public int AcceptedCount { get; set; }
    public int OverdueCount { get; set; }
    public int EscalatedCount { get; set; }
    public int ClosedCount { get; set; }
    public decimal CloseRate => TotalCount > 0 ? (decimal)AcceptedCount / TotalCount * 100 : 0;
    public List<HazardLevelStatistics> LevelStatistics { get; set; } = new List<HazardLevelStatistics>();
}

public class HazardLevelStatistics
{
    public int Level { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public int Count { get; set; }
}
