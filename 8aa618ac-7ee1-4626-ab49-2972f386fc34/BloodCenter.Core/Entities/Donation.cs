using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;

namespace BloodCenter.Core.Entities;

public class Donation : BaseEntity
{
    public string DonationNumber { get; set; } = string.Empty;
    public Guid DonorId { get; set; }
    public Guid CollectionSiteId { get; set; }
    public Guid NurseId { get; set; }
    public DateTime DonationDate { get; set; }
    public int Volume { get; set; }
    public BloodGroup BloodGroup { get; set; } = new();
    public DonationStatus Status { get; set; } = DonationStatus.InProgress;
    public string? Arm { get; set; }
    public string? Reaction { get; set; }
    public string? Notes { get; set; }
    public bool InitialScreeningPassed { get; set; }
    public string? InitialScreeningFailureReason { get; set; }
    public bool AllTestsPassed { get; set; }
    public bool IsQuarantined { get; set; }
    public string? QuarantineReason { get; set; }

    public Donor? Donor { get; set; }
    public CollectionSite? CollectionSite { get; set; }
    public User? Nurse { get; set; }
    public ICollection<InitialScreening> InitialScreenings { get; set; } = new List<InitialScreening>();
    public ICollection<BloodTest> BloodTests { get; set; } = new List<BloodTest>();
    public ICollection<BloodProduct> BloodProducts { get; set; } = new List<BloodProduct>();
}
