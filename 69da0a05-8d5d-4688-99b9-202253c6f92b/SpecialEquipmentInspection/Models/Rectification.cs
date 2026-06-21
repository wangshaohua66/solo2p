using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class Rectification
{
    public int Id { get; set; }

    public int InspectionItemId { get; set; }

    [Required]
    public int InspectionId { get; set; }

    [Required]
    public int DeviceId { get; set; }

    [StringLength(32)]
    public string UseUnitCode { get; set; } = string.Empty;

    [StringLength(128)]
    public string UseUnitName { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    public DateTime NotifyDate { get; set; }

    public DateTime Deadline { get; set; }

    public DateTime? CompleteDate { get; set; }

    public RectificationStatus Status { get; set; }

    public string RectificationResult { get; set; } = string.Empty;

    public bool WarningSent { get; set; }

    public bool ReportedToSupervisor { get; set; }

    public int WarningLevel { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Inspection? Inspection { get; set; }
}
