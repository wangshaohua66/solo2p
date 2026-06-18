using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Inventory
{
    [Key]
    public int Id { get; set; }

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public int WarehouseId { get; set; }

    [ForeignKey(nameof(WarehouseId))]
    public virtual Warehouse Warehouse { get; set; } = null!;

    public int ChemicalId { get; set; }

    [ForeignKey(nameof(ChemicalId))]
    public virtual Chemical Chemical { get; set; } = null!;

    [Column(TypeName = "decimal(15,2)")]
    public decimal Quantity { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal ReservedQuantity { get; set; }

    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    [Column(TypeName = "decimal(15,2)")]
    public decimal MaxCapacity { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal MinSafeQuantity { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal ReorderLevel { get; set; }

    public DateTime? EarliestExpiryDate { get; set; }

    public InventoryStatus Status { get; set; } = InventoryStatus.Normal;

    public bool HasOverstockAlert { get; set; }

    public bool HasLowStockAlert { get; set; }

    public bool HasExpiryAlert { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Timestamp]
    public byte[]? RowVersion { get; set; }

    public virtual ICollection<InventoryTransaction> Transactions { get; set; } = new List<InventoryTransaction>();
}

public enum InventoryStatus
{
    Normal = 1,
    Overstock = 2,
    LowStock = 3,
    NearExpiry = 4,
    Expired = 5,
    Locked = 6
}
