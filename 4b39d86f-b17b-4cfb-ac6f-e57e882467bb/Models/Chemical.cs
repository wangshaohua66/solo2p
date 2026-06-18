using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Chemical
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string CasNo { get; set; } = string.Empty;

    [MaxLength(50)]
    public string UnNo { get; set; } = string.Empty;

    [Required]
    public ChemicalCategory Category { get; set; }

    [MaxLength(200)]
    public string MolecularFormula { get; set; } = string.Empty;

    public HazardClass HazardClass { get; set; }

    [MaxLength(50)]
    public string PackingGroup { get; set; } = string.Empty;

    [MaxLength(500)]
    public string PhysicalProperties { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string StorageRequirements { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string EmergencyMeasures { get; set; } = string.Empty;

    [Column(TypeName = "decimal(10,2)")]
    public decimal StandardPackingWeight { get; set; }

    [MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<ChemicalBatch> ChemicalBatches { get; set; } = new List<ChemicalBatch>();
    public virtual ICollection<Inventory> Inventories { get; set; } = new List<Inventory>();
}

public enum ChemicalCategory
{
    Explosives = 1,
    CompressedGases = 2,
    FlammableLiquids = 3,
    FlammableSolids = 4,
    OxidizingAgents = 5,
    ToxicSubstances = 6,
    RadioactiveMaterials = 7,
    CorrosiveSubstances = 8
}

public enum HazardClass
{
    Class1 = 1,
    Class2 = 2,
    Class3 = 3,
    Class4 = 4,
    Class5 = 5,
    Class6 = 6,
    Class7 = 7,
    Class8 = 8
}
