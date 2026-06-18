using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Enterprise
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string UnifiedSocialCreditCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(100)]
    public string LegalPerson { get; set; } = string.Empty;

    [MaxLength(20)]
    public string ContactPhone { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SafetyManager { get; set; } = string.Empty;

    [MaxLength(20)]
    public string SafetyManagerPhone { get; set; } = string.Empty;

    public EnterpriseType EnterpriseType { get; set; } = EnterpriseType.Production;

    public int HazardLevel { get; set; }

    public bool IsActive { get; set; } = true;

    [Column(TypeName = "decimal(10,6)")]
    public decimal Longitude { get; set; }

    [Column(TypeName = "decimal(10,6)")]
    public decimal Latitude { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<Chemical> Chemicals { get; set; } = new List<Chemical>();
    public virtual ICollection<Warehouse> Warehouses { get; set; } = new List<Warehouse>();
    public virtual ICollection<ChemicalBatch> ChemicalBatches { get; set; } = new List<ChemicalBatch>();
    public virtual ICollection<Inventory> Inventories { get; set; } = new List<Inventory>();
    public virtual ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
    public virtual ICollection<HazardRectification> HazardRectifications { get; set; } = new List<HazardRectification>();
    public virtual ICollection<EmergencyDrill> EmergencyDrills { get; set; } = new List<EmergencyDrill>();
    public virtual ICollection<TransportRecord> TransportRecords { get; set; } = new List<TransportRecord>();
}

public enum EnterpriseType
{
    Production = 1,
    Storage = 2,
    Distribution = 3,
    Use = 4
}
