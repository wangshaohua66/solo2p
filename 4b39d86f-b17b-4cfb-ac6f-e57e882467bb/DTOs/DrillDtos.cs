namespace HazChemSupervision.DTOs;

public class EmergencyDrillDto
{
    public int Id { get; set; }
    public string PlanNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Quarter { get; set; }
    public DateTime PlannedStartTime { get; set; }
    public DateTime PlannedEndTime { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string? Location { get; set; }
    public string? ScenarioDescription { get; set; }
    public string? Objectives { get; set; }
    public int PlannedParticipants { get; set; }
    public int? ActualParticipants { get; set; }
    public string? ParticipantsList { get; set; }
    public string? MaterialsUsed { get; set; }
    public decimal? EstimatedCost { get; set; }
    public decimal? ActualCost { get; set; }
    public string? ExecutionRecord { get; set; }
    public string? ProblemsFound { get; set; }
    public int? EvaluationResult { get; set; }
    public string? EvaluationResultName { get; set; }
    public string? EvaluationComment { get; set; }
    public int? EvaluatorId { get; set; }
    public string? EvaluatorName { get; set; }
    public DateTime? EvaluationTime { get; set; }
    public string? ImprovementMeasures { get; set; }
    public string? ReportUrl { get; set; }
    public bool HasSupervisionReminder { get; set; }
    public int? SupervisionReminderCount { get; set; }
    public DateTime? LastSupervisionReminderTime { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class EmergencyDrillCreateDto
{
    public string PlanNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public int Type { get; set; }
    public int Year { get; set; }
    public int Quarter { get; set; }
    public DateTime PlannedStartTime { get; set; }
    public DateTime PlannedEndTime { get; set; }
    public string? Location { get; set; }
    public string ScenarioDescription { get; set; } = string.Empty;
    public string Objectives { get; set; } = string.Empty;
    public int PlannedParticipants { get; set; }
    public decimal? EstimatedCost { get; set; }
}

public class EmergencyDrillStartDto
{
    public DateTime StartTime { get; set; }
    public int ActualParticipants { get; set; }
    public string? ParticipantsList { get; set; }
    public string? MaterialsUsed { get; set; }
}

public class EmergencyDrillCompleteDto
{
    public DateTime EndTime { get; set; }
    public string ExecutionRecord { get; set; } = string.Empty;
    public string? ProblemsFound { get; set; }
    public decimal? ActualCost { get; set; }
}

public class EmergencyDrillEvaluateDto
{
    public int EvaluatorId { get; set; }
    public string EvaluatorName { get; set; } = string.Empty;
    public int EvaluationResult { get; set; }
    public string EvaluationComment { get; set; } = string.Empty;
    public DateTime EvaluationTime { get; set; }
    public string? ImprovementMeasures { get; set; }
    public string? ReportUrl { get; set; }
}

public class EmergencyDrillQueryDto : PagedRequest
{
    public string? PlanNo { get; set; }
    public string? Name { get; set; }
    public int? EnterpriseId { get; set; }
    public int? Type { get; set; }
    public int? Status { get; set; }
    public int? Year { get; set; }
    public int? Quarter { get; set; }
    public DateRangeFilter? PlannedDateRange { get; set; }
    public bool? IsOverdue { get; set; }
}

public class DrillStatisticsDto
{
    public int Year { get; set; }
    public int? Quarter { get; set; }
    public int? EnterpriseId { get; set; }
    public string? EnterpriseName { get; set; }
    public int PlannedCount { get; set; }
    public int CompletedCount { get; set; }
    public int EvaluatedCount { get; set; }
    public int OverdueCount { get; set; }
    public int CancelledCount { get; set; }
    public decimal ExecutionRate => PlannedCount > 0 ? (decimal)CompletedCount / PlannedCount * 100 : 0;
    public List<DrillTypeStatistics> TypeStatistics { get; set; } = new List<DrillTypeStatistics>();
}

public class DrillTypeStatistics
{
    public int Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class DrillSupervisionDto
{
    public int DrillId { get; set; }
    public string PlanNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public DateTime PlannedStartTime { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public int OverdueDays { get; set; }
    public int ReminderCount { get; set; }
}
