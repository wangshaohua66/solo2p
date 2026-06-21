using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class Inspector
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(32)]
    public string CertificateNo { get; set; } = string.Empty;

    [Required]
    public string CertifiableTypes { get; set; } = string.Empty;

    public DateTime IssueDate { get; set; }

    public DateTime ExpiryDate { get; set; }

    [StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    public InspectorStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
