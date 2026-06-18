using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Alert
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string AlertNo { get; set; } = string.Empty;

    public AlertType Type { get; set; }

    public AlertLevel Level { get; set; }

    public AlertStatus Status { get; set; } = AlertStatus.New;

    public int? EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise? Enterprise { get; set; }

    public int? ChemicalId { get; set; }

    [ForeignKey(nameof(ChemicalId))]
    public virtual Chemical? Chemical { get; set; }

    public int? WarehouseId { get; set; }

    [ForeignKey(nameof(WarehouseId))]
    public virtual Warehouse? Warehouse { get; set; }

    public int? ChemicalBatchId { get; set; }

    [ForeignKey(nameof(ChemicalBatchId))]
    public virtual ChemicalBatch? ChemicalBatch { get; set; }

    public int? TransportRecordId { get; set; }

    [ForeignKey(nameof(TransportRecordId))]
    public virtual TransportRecord? TransportRecord { get; set; }

    public int? HazardRectificationId { get; set; }

    [ForeignKey(nameof(HazardRectificationId))]
    public virtual HazardRectification? HazardRectification { get; set; }

    public int? CertificateId { get; set; }

    [ForeignKey(nameof(CertificateId))]
    public virtual Certificate? Certificate { get; set; }

    public int? EmergencyDrillId { get; set; }

    [ForeignKey(nameof(EmergencyDrillId))]
    public virtual EmergencyDrill? EmergencyDrill { get; set; }

    [Required]
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Content { get; set; }

    [MaxLength(2000)]
    public string? Suggestion { get; set; }

    [MaxLength(50)]
    public string? RecipientRole { get; set; }

    public int? RecipientUserId { get; set; }

    public bool IsRead { get; set; }

    public DateTime? ReadTime { get; set; }

    public bool IsHandled { get; set; }

    public DateTime? HandleTime { get; set; }

    [MaxLength(2000)]
    public string? HandleResult { get; set; }

    public int? HandlerUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum AlertType
{
    InventoryOverstock = 1,
    InventoryLowStock = 2,
    NearExpiry = 3,
    Expired = 4,
    TransportDeviation = 5,
    TransportOverspeeding = 6,
    TransportTemperatureAbnormal = 7,
    HazardOverdue = 8,
    HazardEscalation = 9,
    CertificateExpiring = 10,
    CertificateExpired = 11,
    CertificateInvalid = 12,
    DrillOverdue = 13,
    DrillSupervision = 14,
    ComplianceViolation = 15,
    SafetyProduction = 16,
    System = 99
}

public enum AlertLevel
{
    Info = 1,
    Warning = 2,
    Danger = 3,
    Critical = 4
}

public enum AlertStatus
{
    New = 1,
    Processing = 2,
    Handled = 3,
    Ignored = 4,
    Closed = 5
}
