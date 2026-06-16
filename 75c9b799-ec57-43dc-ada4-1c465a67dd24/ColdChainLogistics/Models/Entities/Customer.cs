namespace ColdChainLogistics.Models.Entities;

public class Customer : BaseEntity
{
    public string CustomerCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Shipment> Shipments { get; set; } = new List<Shipment>();
    public ICollection<AlertRule> AlertRules { get; set; } = new List<AlertRule>();
    public ICollection<NotificationPreference> NotificationPreferences { get; set; } = new List<NotificationPreference>();
}

public class NotificationPreference : BaseEntity
{
    public long CustomerId { get; set; }
    public AlertSeverity Severity { get; set; }
    public NotificationChannel Channel { get; set; }
    public string? Recipient { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int EscalationLevel { get; set; }
    public int EscalationTimeoutMinutes { get; set; } = 30;

    public Customer? Customer { get; set; }
}
