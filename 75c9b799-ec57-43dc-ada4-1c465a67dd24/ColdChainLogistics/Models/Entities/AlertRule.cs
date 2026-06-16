namespace ColdChainLogistics.Models.Entities;

public class AlertRule : BaseEntity
{
    public string RuleName { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public string? Description { get; set; }
    public bool IsEnabled { get; set; } = true;
    public AlertSeverity Severity { get; set; } = AlertSeverity.Warning;
    public RuleLogicalOperator LogicalOperator { get; set; } = RuleLogicalOperator.And;
    public int DurationSeconds { get; set; } = 0;
    public DetectionMode DetectionMode { get; set; } = DetectionMode.SustainedDeviation;
    public int WindowSizeMinutes { get; set; } = 5;
    public double? BaselineTemperature { get; set; }
    public double? BaselineHumidity { get; set; }
    public bool AutoCalibrateBaseline { get; set; } = false;
    public int CalibrationPeriodDays { get; set; } = 7;
    public string? ApplicableSensorTypes { get; set; }
    public string? ApplicableRoutes { get; set; }
    public int Priority { get; set; } = 100;
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }

    public Customer? Customer { get; set; }
    public ICollection<AlertRuleCondition> Conditions { get; set; } = new List<AlertRuleCondition>();
    public ICollection<AlertRuleAuditLog> AuditLogs { get; set; } = new List<AlertRuleAuditLog>();
}

public class AlertRuleCondition : BaseEntity
{
    public long AlertRuleId { get; set; }
    public int ConditionGroup { get; set; } = 1;
    public RuleLogicalOperator GroupOperator { get; set; } = RuleLogicalOperator.And;
    public string Metric { get; set; } = string.Empty;
    public RuleConditionOperator Operator { get; set; }
    public double ThresholdValue { get; set; }
    public double? ThresholdValue2 { get; set; }
    public string? Unit { get; set; }

    public AlertRule? AlertRule { get; set; }
}

public class AlertRuleAuditLog : BaseEntity
{
    public long AlertRuleId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string Operator { get; set; } = string.Empty;
    public string? IpAddress { get; set; }

    public AlertRule? AlertRule { get; set; }
}
