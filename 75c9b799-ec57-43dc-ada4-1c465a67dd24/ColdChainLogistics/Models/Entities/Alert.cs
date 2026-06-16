namespace ColdChainLogistics.Models.Entities;

public class Alert : BaseEntity
{
    public string AlertCode { get; set; } = string.Empty;
    public long AlertRuleId { get; set; }
    public long? CustomerId { get; set; }
    public long? VehicleId { get; set; }
    public long? SensorId { get; set; }
    public long? ShipmentId { get; set; }
    public AlertSeverity Severity { get; set; }
    public AlertStatus Status { get; set; } = AlertStatus.New;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime FirstTriggeredAt { get; set; }
    public DateTime? LastTriggeredAt { get; set; }
    public int TriggerCount { get; set; } = 1;
    public double? TriggerValue { get; set; }
    public string? TriggerMetric { get; set; }
    public string? AcknowledgedBy { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolutionNotes { get; set; }
    public int EscalationLevel { get; set; } = 1;
    public DateTime? NextEscalationAt { get; set; }
    public bool IsEscalated { get; set; }

    public AlertRule? AlertRule { get; set; }
    public Customer? Customer { get; set; }
    public Vehicle? Vehicle { get; set; }
    public Sensor? Sensor { get; set; }
    public Shipment? Shipment { get; set; }
    public ICollection<NotificationRecord> Notifications { get; set; } = new List<NotificationRecord>();
}

public class NotificationRecord : BaseEntity
{
    public long AlertId { get; set; }
    public long? CustomerId { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? Content { get; set; }
    public bool IsSent { get; set; }
    public DateTime? SentAt { get; set; }
    public int RetryCount { get; set; }
    public string? ErrorMessage { get; set; }
    public int EscalationLevel { get; set; }

    public Alert? Alert { get; set; }
    public Customer? Customer { get; set; }
}
