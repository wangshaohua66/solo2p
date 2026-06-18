using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class HazardRectification
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string WorkOrderNo { get; set; } = string.Empty;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public HazardSource Source { get; set; }

    [Required]
    [MaxLength(500)]
    public string HazardDescription { get; set; } = string.Empty;

    public HazardLevel Level { get; set; }

    [Required]
    [MaxLength(50)]
    public string ResponsiblePerson { get; set; } = string.Empty;

    [MaxLength(20)]
    public string ResponsiblePersonPhone { get; set; } = string.Empty;

    public int? ResponsiblePersonId { get; set; }

    public DateTime DiscoveryTime { get; set; }

    public DateTime Deadline { get; set; }

    public HazardRectificationStatus Status { get; set; } = HazardRectificationStatus.Pending;

    [MaxLength(2000)]
    public string? AcceptanceCriteria { get; set; }

    [MaxLength(2000)]
    public string? RectificationMeasures { get; set; }

    public DateTime? RectificationStartTime { get; set; }

    public DateTime? RectificationCompleteTime { get; set; }

    [MaxLength(2000)]
    public string? RectificationResult { get; set; }

    [MaxLength(200)]
    public string? RectificationAttachmentUrl { get; set; }

    public int? InspectorId { get; set; }

    [MaxLength(50)]
    public string? InspectorName { get; set; }

    public DateTime? InspectionTime { get; set; }

    public bool? InspectionPassed { get; set; }

    [MaxLength(2000)]
    public string? InspectionComment { get; set; }

    public bool IsEscalated { get; set; }

    public int EscalationLevel { get; set; }

    public DateTime? EscalationTime { get; set; }

    [MaxLength(2000)]
    public string? EscalationReason { get; set; }

    public int OverdueDays { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum HazardSource
{
    OnSiteInspection = 1,
    RemoteMonitoring = 2,
    EnterpriseSelfReport = 3,
    PublicReport = 4,
    EmergencyDrill = 5,
    Other = 99
}

public enum HazardLevel
{
    General = 1,
    Major = 2,
    Severe = 3,
    Critical = 4
}

public enum HazardRectificationStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
    Inspecting = 4,
    Accepted = 5,
    Rejected = 6,
    Overdue = 7,
    Escalated = 8,
    Closed = 9
}
