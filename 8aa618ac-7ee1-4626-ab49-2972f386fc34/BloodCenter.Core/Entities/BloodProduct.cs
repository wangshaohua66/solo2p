using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;

namespace BloodCenter.Core.Entities;

public class BloodProduct : BaseEntity
{
    public string ProductCode { get; set; } = string.Empty;
    public Guid DonationId { get; set; }
    public BloodProductType ProductType { get; set; }
    public BloodGroup BloodGroup { get; set; } = new();
    public int Volume { get; set; }
    public string Unit { get; set; } = "ml";
    public DateTime ProductionDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public string? StorageLocation { get; set; }
    public string? StorageTemperature { get; set; }
    public InventoryStatus Status { get; set; } = InventoryStatus.Quarantined;
    public bool IsSpecialProduct { get; set; }
    public string? SpecialProductReason { get; set; }
    public string? PreparationMethod { get; set; }
    public Guid? PreparedById { get; set; }
    public DateTime? PreparedAt { get; set; }
    public string? BatchNumber { get; set; }

    public Donation? Donation { get; set; }
    public User? PreparedBy { get; set; }
    public ICollection<ScrapRecord> ScrapRecords { get; set; } = new List<ScrapRecord>();
    public ICollection<CrossMatch> CrossMatches { get; set; } = new List<CrossMatch>();
}
