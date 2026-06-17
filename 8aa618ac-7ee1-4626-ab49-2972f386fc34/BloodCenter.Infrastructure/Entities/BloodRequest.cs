using BloodCenter.Infrastructure.Entities.Enums;
using BloodCenter.Infrastructure.Entities.ValueObjects;

namespace BloodCenter.Infrastructure.Entities;

public class BloodRequest : BaseEntity
{
    public string RequestNumber { get; set; } = string.Empty;
    public Guid HospitalId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientId { get; set; } = string.Empty;
    public int? PatientAge { get; set; }
    public string? PatientGender { get; set; }
    public string? Diagnosis { get; set; }
    public BloodGroup PatientBloodGroup { get; set; } = new();
    public BloodProductType ProductType { get; set; }
    public int QuantityRequested { get; set; }
    public int QuantityIssued { get; set; }
    public UrgencyLevel Urgency { get; set; }
    public DateTime RequiredDate { get; set; }
    public string Ward { get; set; } = string.Empty;
    public string? BedNumber { get; set; }
    public string RequestedBy { get; set; } = string.Empty;
    public string? RequestDoctor { get; set; }
    public string? TransfusionHistory { get; set; }
    public string? PregnancyHistory { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime? FulfilledAt { get; set; }
    public string? Notes { get; set; }

    public Hospital? Hospital { get; set; }
    public ICollection<CrossMatch> CrossMatches { get; set; } = new List<CrossMatch>();
}
