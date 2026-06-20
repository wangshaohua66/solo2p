using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.WorkOrder;

public class WorkOrderDto
{
    public long Id { get; set; }
    public string OrderNo { get; set; } = string.Empty;
    public string? SourceType { get; set; }
    public long? SourceId { get; set; }
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public long? DeviceId { get; set; }
    public string? DeviceCode { get; set; }
    public string? DeviceName { get; set; }
    public long? AlarmId { get; set; }
    public string? AlarmNo { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public HazardLevel Priority { get; set; }
    public string PriorityName { get; set; } = string.Empty;
    public HazardStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? AssignedTo { get; set; }
    public long? AssignedToId { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime Deadline { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Resolution { get; set; }
    public string? Photos { get; set; }
    public string? Remark { get; set; }
    public bool IsOverdue { get; set; }
    public int EscalationLevel { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WorkOrderCreateDto
{
    public string? SourceType { get; set; }
    public long? SourceId { get; set; }
    public long FireUnitId { get; set; }
    public long? DeviceId { get; set; }
    public long? AlarmId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public HazardLevel Priority { get; set; } = HazardLevel.General;
    public string? AssignedTo { get; set; }
    public long? AssignedToId { get; set; }
    public DateTime Deadline { get; set; }
    public string? Photos { get; set; }
    public string? Remark { get; set; }
}

public class WorkOrderUpdateDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public HazardLevel? Priority { get; set; }
    public string? AssignedTo { get; set; }
    public long? AssignedToId { get; set; }
    public DateTime? Deadline { get; set; }
    public string? Remark { get; set; }
}

public class WorkOrderQueryDto : PagedQuery
{
    public HazardLevel? Priority { get; set; }
    public HazardStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public long? DeviceId { get; set; }
    public long? AlarmId { get; set; }
    public long? AssignedToId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsOverdue { get; set; }
    public string? SourceType { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class WorkOrderAssignDto
{
    public long WorkOrderId { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
    public long? AssignedToId { get; set; }
    public long OperatorId { get; set; }
}

public class WorkOrderStartDto
{
    public long WorkOrderId { get; set; }
    public long OperatorId { get; set; }
    public string? Remark { get; set; }
}

public class WorkOrderCompleteDto
{
    public long WorkOrderId { get; set; }
    public string Resolution { get; set; } = string.Empty;
    public string? Photos { get; set; }
    public long OperatorId { get; set; }
}

public class WorkOrderStatisticsDto
{
    public int TotalCount { get; set; }
    public int RegisteredCount { get; set; }
    public int ProcessingCount { get; set; }
    public int CompletedCount { get; set; }
    public int OverdueCount { get; set; }
    public double CompletionRate { get; set; }
    public double AverageCompletionHours { get; set; }
}
