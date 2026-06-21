using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class SupervisionReport
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string ReportCode { get; set; } = string.Empty;

    public int? RectificationId { get; set; }

    public int? InspectionId { get; set; }

    [Required]
    public int DeviceId { get; set; }

    [StringLength(32)]
    public string DeviceCode { get; set; } = string.Empty;

    [StringLength(64)]
    public string ReportType { get; set; } = string.Empty;

    public string Payload { get; set; } = string.Empty;

    public SupervisionReportStatus Status { get; set; }

    [StringLength(256)]
    public string Remark { get; set; } = string.Empty;

    public DateTime? ReportedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
