namespace ColdChainLogistics.Models.Entities;

public class ReportRecord : BaseEntity
{
    public string ReportNumber { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public long? ShipmentId { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public DateTime ReportPeriodStart { get; set; }
    public DateTime ReportPeriodEnd { get; set; }
    public string? FilePath { get; set; }
    public string? FileName { get; set; }
    public long FileSize { get; set; }
    public string? GeneratedBy { get; set; }
    public DateTime? GeneratedAt { get; set; }
    public string? Status { get; set; }
    public string? ErrorMessage { get; set; }

    public Customer? Customer { get; set; }
    public Shipment? Shipment { get; set; }
}
