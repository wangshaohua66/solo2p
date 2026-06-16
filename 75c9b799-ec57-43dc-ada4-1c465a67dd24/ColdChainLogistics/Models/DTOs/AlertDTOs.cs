namespace ColdChainLogistics.Models.DTOs;

public class AlertRuleCreateRequest
{
    public string RuleName { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public string? Description { get; set; }
    public int Severity { get; set; }
    public int LogicalOperator { get; set; }
    public int DurationSeconds { get; set; }
    public int DetectionMode { get; set; }
    public int WindowSizeMinutes { get; set; }
    public bool AutoCalibrateBaseline { get; set; }
    public int Priority { get; set; } = 100;
    public List<AlertRuleConditionDto> Conditions { get; set; } = new();
}

public class AlertRuleUpdateRequest
{
    public long Id { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
    public int Severity { get; set; }
    public int LogicalOperator { get; set; }
    public int DurationSeconds { get; set; }
    public int DetectionMode { get; set; }
    public int WindowSizeMinutes { get; set; }
    public bool AutoCalibrateBaseline { get; set; }
    public int Priority { get; set; }
    public List<AlertRuleConditionDto>? Conditions { get; set; }
}

public class AlertRuleConditionDto
{
    public long? Id { get; set; }
    public int ConditionGroup { get; set; } = 1;
    public int GroupOperator { get; set; } = 1;
    public string Metric { get; set; } = string.Empty;
    public int Operator { get; set; }
    public double ThresholdValue { get; set; }
    public double? ThresholdValue2 { get; set; }
    public string? Unit { get; set; }
}

public class AlertRuleQueryRequest : PagedRequest
{
    public long? CustomerId { get; set; }
    public string? RuleName { get; set; }
    public int? Severity { get; set; }
    public bool? IsEnabled { get; set; }
}

public class AlertRuleDto
{
    public long Id { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
    public int Severity { get; set; }
    public string SeverityText { get; set; } = string.Empty;
    public int LogicalOperator { get; set; }
    public int DurationSeconds { get; set; }
    public int DetectionMode { get; set; }
    public int WindowSizeMinutes { get; set; }
    public double? BaselineTemperature { get; set; }
    public double? BaselineHumidity { get; set; }
    public bool AutoCalibrateBaseline { get; set; }
    public int Priority { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<AlertRuleConditionDto> Conditions { get; set; } = new();
}

public class AlertQueryRequest : PagedRequest
{
    public long? CustomerId { get; set; }
    public long? VehicleId { get; set; }
    public long? SensorId { get; set; }
    public long? ShipmentId { get; set; }
    public int? Severity { get; set; }
    public int? Status { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class AlertDto
{
    public long Id { get; set; }
    public string AlertCode { get; set; } = string.Empty;
    public long AlertRuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public long? VehicleId { get; set; }
    public string? VehicleNumber { get; set; }
    public long? SensorId { get; set; }
    public string? SensorCode { get; set; }
    public long? ShipmentId { get; set; }
    public string? ShipmentNumber { get; set; }
    public int Severity { get; set; }
    public string SeverityText { get; set; } = string.Empty;
    public int Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime FirstTriggeredAt { get; set; }
    public DateTime? LastTriggeredAt { get; set; }
    public int TriggerCount { get; set; }
    public double? TriggerValue { get; set; }
    public string? TriggerMetric { get; set; }
    public int EscalationLevel { get; set; }
}

public class AlertAcknowledgeRequest
{
    public long Id { get; set; }
    public string? Remark { get; set; }
}

public class AlertResolveRequest
{
    public long Id { get; set; }
    public string ResolutionNotes { get; set; } = string.Empty;
}
