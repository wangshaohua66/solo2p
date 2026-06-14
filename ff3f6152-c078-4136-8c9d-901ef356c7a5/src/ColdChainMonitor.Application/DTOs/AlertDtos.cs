using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Domain.Models;

namespace ColdChainMonitor.Application.DTOs;

public class AlertDto
{
    public string Id { get; set; } = string.Empty;
    public string AlertNo { get; set; } = string.Empty;
    public AlertType AlertType { get; set; }
    public string AlertTypeText { get; set; } = string.Empty;
    public AlertLevel AlertLevel { get; set; }
    public string AlertLevelText { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public string? TransportTaskId { get; set; }
    public string? TaskNo { get; set; }
    public double? Value { get; set; }
    public double? Threshold { get; set; }
    public int? DurationSeconds { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsAcknowledged { get; set; }
    public string? AcknowledgedBy { get; set; }
    public string? AcknowledgedByName { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public bool IsResolved { get; set; }
    public string? ResolvedBy { get; set; }
    public string? ResolvedByName { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime FirstTriggeredAt { get; set; }
    public DateTime LastTriggeredAt { get; set; }
    public int TriggerCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AlertQueryRequest : CursorPagedQuery
{
    public AlertLevel? AlertLevel { get; set; }
    public AlertType? AlertType { get; set; }
    public bool? IsAcknowledged { get; set; }
    public bool? IsResolved { get; set; }
    public string? DeviceId { get; set; }
    public string? TransportTaskId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class AcknowledgeAlertRequest
{
    public string Remark { get; set; } = string.Empty;
}

public class ResolveAlertRequest
{
    public string Remark { get; set; } = string.Empty;
}

public class AlertRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string RuleName { get; set; } = string.Empty;
    public string RuleCode { get; set; } = string.Empty;
    public AlertType AlertType { get; set; }
    public AlertLevel AlertLevel { get; set; }
    public MetricType MetricType { get; set; }
    public ComparisonOperator Operator { get; set; }
    public double Threshold { get; set; }
    public int DurationSeconds { get; set; }
    public RuleScope Scope { get; set; }
    public bool IsEnabled { get; set; }
    public string? Description { get; set; }
    public int Priority { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateAlertRuleRequest
{
    public string RuleName { get; set; } = string.Empty;
    public string RuleCode { get; set; } = string.Empty;
    public AlertType AlertType { get; set; }
    public AlertLevel AlertLevel { get; set; }
    public MetricType MetricType { get; set; }
    public ComparisonOperator Operator { get; set; }
    public double Threshold { get; set; }
    public int DurationSeconds { get; set; }
    public RuleScope Scope { get; set; }
    public List<string>? TargetDeviceIds { get; set; }
    public string? Description { get; set; }
    public int Priority { get; set; } = 100;
}

public class UpdateAlertRuleRequest
{
    public string? RuleName { get; set; }
    public AlertLevel? AlertLevel { get; set; }
    public double? Threshold { get; set; }
    public int? DurationSeconds { get; set; }
    public bool? IsEnabled { get; set; }
    public string? Description { get; set; }
    public int? Priority { get; set; }
}
