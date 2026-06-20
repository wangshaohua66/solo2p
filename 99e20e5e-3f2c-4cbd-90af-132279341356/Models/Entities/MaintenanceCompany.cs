using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class MaintenanceCompany : BaseEntity
{
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string? UnifiedSocialCreditCode { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? LegalPerson { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? QualificationCert { get; set; }
    public DateTime? QualificationExpiryDate { get; set; }
    public int Rating { get; set; } = 3;
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }

    public ICollection<MaintenanceContract> Contracts { get; set; } = new List<MaintenanceContract>();
}
