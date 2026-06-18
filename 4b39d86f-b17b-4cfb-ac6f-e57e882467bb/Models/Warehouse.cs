using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Warehouse
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [Column(TypeName = "decimal(10,6)")]
    public decimal Longitude { get; set; }

    [Column(TypeName = "decimal(10,6)")]
    public decimal Latitude { get; set; }

    public WarehouseType Type { get; set; } = WarehouseType.General;

    public int FireRatingLevel { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal MaxCapacity { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal CurrentUsedCapacity { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal Temperature { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal Humidity { get; set; }

    public HazardClass AllowedHazardClass { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<Inventory> Inventories { get; set; } = new List<Inventory>();
    public virtual ICollection<ChemicalBatch> ChemicalBatches { get; set; } = new List<ChemicalBatch>();
}

public enum WarehouseType
{
    General = 1,
    LowTemperature = 2,
    Pressure = 3,
    ExplosionProof = 4,
    ToxicIsolation = 5
}
