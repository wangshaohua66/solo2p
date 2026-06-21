using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class Inspection
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string InspectionCode { get; set; } = string.Empty;

    public int? PlanId { get; set; }

    [Required]
    public int DeviceId { get; set; }

    [StringLength(32)]
    public string DeviceCode { get; set; } = string.Empty;

    [StringLength(128)]
    public string DeviceName { get; set; } = string.Empty;

    public DeviceType DeviceType { get; set; }

    [Required]
    public int InspectorId { get; set; }

    [StringLength(32)]
    public string InspectorName { get; set; } = string.Empty;

    public DateTime ScheduledDate { get; set; }

    public DateTime? InspectionDate { get; set; }

    public InspectionStatus Status { get; set; }

    public InspectionResult Result { get; set; }

    public string Conclusion { get; set; } = string.Empty;

    public DateTime? NextInspectionDate { get; set; }

    public string Photos { get; set; } = "[]";

    public string Videos { get; set; } = "[]";

    public string Findings { get; set; } = string.Empty;

    public int? ReportId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Device? Device { get; set; }

    public InspectionPlan? Plan { get; set; }

    public List<InspectionItem> Items { get; set; } = new();

    public List<Rectification> Rectifications { get; set; } = new();
}
