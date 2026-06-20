using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class TrainingPlan
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int SpecialtyId { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    [Column(TypeName = "date")]
    public DateTime StartDate { get; set; }

    [Column(TypeName = "date")]
    public DateTime EndDate { get; set; }

    public PlanStatus Status { get; set; } = PlanStatus.Draft;

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<TrainingSchedule>? Schedules { get; set; }

    public ICollection<TrainingPlanStation>? PlanStations { get; set; }
}

public enum PlanStatus
{
    Draft = 0,
    Published = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public class TrainingPlanStation
{
    [Key]
    public int Id { get; set; }

    public int TrainingPlanId { get; set; }

    [ForeignKey(nameof(TrainingPlanId))]
    public TrainingPlan? TrainingPlan { get; set; }

    public int FireStationId { get; set; }

    [ForeignKey(nameof(FireStationId))]
    public FireStation? FireStation { get; set; }

    public int ParticipantCount { get; set; }
}
