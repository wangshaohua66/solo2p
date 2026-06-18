using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class Certificate
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string CertificateNo { get; set; } = string.Empty;

    public CertificateType Type { get; set; }

    [Required]
    [MaxLength(200)]
    public string HolderName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? HolderIdCard { get; set; }

    public int? EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise? Enterprise { get; set; }

    public int? UserId { get; set; }

    [MaxLength(100)]
    public string IssuingAuthority { get; set; } = string.Empty;

    public DateTime IssueDate { get; set; }

    public DateTime ExpiryDate { get; set; }

    public CertificateStatus Status { get; set; } = CertificateStatus.Valid;

    [MaxLength(500)]
    public string? Scope { get; set; }

    [MaxLength(200)]
    public string? AttachmentUrl { get; set; }

    public bool Verified { get; set; }

    public DateTime? LastVerifiedTime { get; set; }

    public string? VerificationResult { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum CertificateType
{
    SafetyProductionLicense = 1,
    HazardousChemicalBusinessLicense = 2,
    SpecialOperationCertificate = 3,
    DangerousGoodsDriverLicense = 4,
    SafetyManagerCertificate = 5,
    FireSafetyCertificate = 6,
    PressureVesselOperationCertificate = 7,
    ChemicalEngineerCertificate = 8
}

public enum CertificateStatus
{
    Valid = 1,
    Expiring = 2,
    Expired = 3,
    Revoked = 4,
    Suspended = 5
}
