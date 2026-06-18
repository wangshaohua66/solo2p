using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class ChemicalBatch
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string BatchNo { get; set; } = string.Empty;

    public int ChemicalId { get; set; }

    [ForeignKey(nameof(ChemicalId))]
    public virtual Chemical Chemical { get; set; } = null!;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public int? WarehouseId { get; set; }

    [ForeignKey(nameof(WarehouseId))]
    public virtual Warehouse? Warehouse { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal Quantity { get; set; }

    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    public DateTime ProductionDate { get; set; }

    public DateTime ExpiryDate { get; set; }

    public BatchStatus Status { get; set; } = BatchStatus.RawMaterial;

    public DateTime? RawMaterialInboundTime { get; set; }

    public int? RawMaterialOperatorId { get; set; }

    [MaxLength(500)]
    public string? RawMaterialRemark { get; set; }

    public DateTime? ProductionStartTime { get; set; }

    public DateTime? ProductionEndTime { get; set; }

    public int? ProductionOperatorId { get; set; }

    [MaxLength(1000)]
    public string? ProductionProcessRecord { get; set; }

    public DateTime? InspectionTime { get; set; }

    public int? InspectorId { get; set; }

    [MaxLength(200)]
    public string? InspectionReportUrl { get; set; }

    [MaxLength(2000)]
    public string? InspectionResult { get; set; }

    public bool? InspectionPassed { get; set; }

    public DateTime? OutboundReviewTime { get; set; }

    public int? OutboundReviewerId { get; set; }

    [MaxLength(500)]
    public string? OutboundRemark { get; set; }

    public int? TransportRecordId { get; set; }

    [ForeignKey(nameof(TransportRecordId))]
    public virtual TransportRecord? TransportRecord { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<ProcessRecord> ProcessRecords { get; set; } = new List<ProcessRecord>();
    public virtual ICollection<InventoryTransaction> InventoryTransactions { get; set; } = new List<InventoryTransaction>();
}

public enum BatchStatus
{
    RawMaterial = 1,
    InProduction = 2,
    Inspecting = 3,
    Qualified = 4,
    Unqualified = 5,
    InStorage = 6,
    OutForDelivery = 7,
    Delivered = 8,
    Cancelled = 9
}
