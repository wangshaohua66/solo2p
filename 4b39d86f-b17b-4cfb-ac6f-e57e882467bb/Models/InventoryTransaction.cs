using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class InventoryTransaction
{
    [Key]
    public long Id { get; set; }

    [MaxLength(64)]
    public string? IdempotencyKey { get; set; }

    public int InventoryId { get; set; }

    [ForeignKey(nameof(InventoryId))]
    public virtual Inventory Inventory { get; set; } = null!;

    public int? ChemicalBatchId { get; set; }

    [ForeignKey(nameof(ChemicalBatchId))]
    public virtual ChemicalBatch? ChemicalBatch { get; set; }

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public int WarehouseId { get; set; }

    [ForeignKey(nameof(WarehouseId))]
    public virtual Warehouse Warehouse { get; set; } = null!;

    public int ChemicalId { get; set; }

    [ForeignKey(nameof(ChemicalId))]
    public virtual Chemical Chemical { get; set; } = null!;

    public InventoryTransactionType TransactionType { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal Quantity { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal BalanceBefore { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal BalanceAfter { get; set; }

    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Remark { get; set; }

    public int OperatorId { get; set; }

    [MaxLength(50)]
    public string OperatorName { get; set; } = string.Empty;

    public DateTime TransactionTime { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum InventoryTransactionType
{
    RawMaterialInbound = 1,
    ProductionInput = 2,
    FinishedGoodsInbound = 3,
    SalesOutbound = 4,
    InventoryAdjustment = 5,
    ReturnInbound = 6,
    Scrap = 7,
    TransferIn = 8,
    TransferOut = 9
}
