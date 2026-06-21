using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class Report
{
    public int Id { get; set; }

    [Required]
    public int InspectionId { get; set; }

    [Required]
    [StringLength(32)]
    public string ReportNo { get; set; } = string.Empty;

    public string DeviceInfo { get; set; } = string.Empty;

    [StringLength(256)]
    public string InspectionBasis { get; set; } = string.Empty;

    public string ItemsSummary { get; set; } = string.Empty;

    public InspectionResult Conclusion { get; set; }

    public DateTime? NextInspectionDate { get; set; }

    public DateTime GeneratedDate { get; set; }

    [StringLength(32)]
    public string ApprovedBy { get; set; } = string.Empty;

    public DateTime? ApprovedDate { get; set; }

    public ReportStatus Status { get; set; }

    [StringLength(256)]
    public string SealedPdfPath { get; set; } = string.Empty;

    [StringLength(256)]
    public string Remark { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public Inspection? Inspection { get; set; }
}
