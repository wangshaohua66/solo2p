using BloodCenter.Infrastructure.Entities.Enums;
using BloodCenter.Infrastructure.Entities.ValueObjects;

namespace BloodCenter.Infrastructure.Entities;

public class Donor : BaseEntity
{
    public string DonorNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string IdCardNumber { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public Address? Address { get; set; }
    public BloodGroup? BloodGroup { get; set; }
    public DonorStatus Status { get; set; } = DonorStatus.Eligible;
    public DeferralReason? DeferralReason { get; set; }
    public DateTime? DeferralUntil { get; set; }
    public DateTime? LastDonationDate { get; set; }
    public DateTime? NextEligibleDate { get; set; }
    public int TotalDonations { get; set; }
    public decimal TotalVolumeDonated { get; set; }
    public bool IsVolunteer { get; set; } = true;
    public string? Occupation { get; set; }
    public string? Notes { get; set; }

    public ICollection<Donation> Donations { get; set; } = new List<Donation>();
    public ICollection<DonorMedicalHistory> MedicalHistory { get; set; } = new List<DonorMedicalHistory>();
}
