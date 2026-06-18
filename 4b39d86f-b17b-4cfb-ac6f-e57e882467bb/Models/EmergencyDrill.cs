using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class EmergencyDrill
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string PlanNo { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public DrillType Type { get; set; }

    public DrillStatus Status { get; set; } = DrillStatus.Planned;

    public int Year { get; set; }

    public int Quarter { get; set; }

    public DateTime PlannedStartTime { get; set; }

    public DateTime PlannedEndTime { get; set; }

    public DateTime? ActualStartTime { get; set; }

    public DateTime? ActualEndTime { get; set; }

    [MaxLength(500)]
    public string? Location { get; set; }

    [MaxLength(2000)]
    public string? ScenarioDescription { get; set; }

    [MaxLength(2000)]
    public string? Objectives { get; set; }

    public int PlannedParticipants { get; set; }

    public int? ActualParticipants { get; set; }

    [MaxLength(2000)]
    public string? ParticipantsList { get; set; }

    [MaxLength(500)]
    public string? MaterialsUsed { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal? EstimatedCost { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal? ActualCost { get; set; }

    [MaxLength(2000)]
    public string? ExecutionRecord { get; set; }

    [MaxLength(2000)]
    public string? ProblemsFound { get; set; }

    public DrillEvaluationResult? EvaluationResult { get; set; }

    [MaxLength(2000)]
    public string? EvaluationComment { get; set; }

    public int? EvaluatorId { get; set; }

    [MaxLength(50)]
    public string? EvaluatorName { get; set; }

    public DateTime? EvaluationTime { get; set; }

    [MaxLength(2000)]
    public string? ImprovementMeasures { get; set; }

    [MaxLength(200)]
    public string? ReportUrl { get; set; }

    public bool HasSupervisionReminder { get; set; }

    public int? SupervisionReminderCount { get; set; }

    public DateTime? LastSupervisionReminderTime { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum DrillType
{
    FireFighting = 1,
    LeakageHandling = 2,
    Evacuation = 3,
    FirstAid = 4,
    Comprehensive = 5,
    Tabletop = 6
}

public enum DrillStatus
{
    Planned = 1,
    Scheduled = 2,
    InProgress = 3,
    Completed = 4,
    Evaluated = 5,
    Cancelled = 6,
    Overdue = 7
}

public enum DrillEvaluationResult
{
    Excellent = 1,
    Good = 2,
    Pass = 3,
    Fail = 4
}
