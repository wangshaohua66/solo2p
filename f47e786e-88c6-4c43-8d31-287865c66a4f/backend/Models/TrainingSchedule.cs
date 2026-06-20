using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class TrainingSchedule
{
    [Key]
    public int Id { get; set; }

    public int? TrainingPlanId { get; set; }

    [ForeignKey(nameof(TrainingPlanId))]
    public TrainingPlan? TrainingPlan { get; set; }

    public int CourseId { get; set; }

    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    public int RoomId { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    [Column(TypeName = "date")]
    public DateTime ScheduleDate { get; set; }

    public int DayOfWeek { get; set; }

    public int StartHour { get; set; }

    public int StartMinute { get; set; }

    public int EndHour { get; set; }

    public int EndMinute { get; set; }

    public int DurationMinutes { get; set; }

    [MaxLength(200)]
    public string? Instructor { get; set; }

    public int? MaxParticipants { get; set; }

    public ScheduleStatus Status { get; set; } = ScheduleStatus.Scheduled;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<ScheduleParticipant>? Participants { get; set; }
}

public enum ScheduleStatus
{
    Scheduled = 0,
    InProgress = 1,
    Completed = 2,
    Cancelled = 3,
    Rescheduled = 4
}

public class ScheduleParticipant
{
    [Key]
    public int Id { get; set; }

    public int TrainingScheduleId { get; set; }

    [ForeignKey(nameof(TrainingScheduleId))]
    public TrainingSchedule? TrainingSchedule { get; set; }

    public int FirefighterId { get; set; }

    [ForeignKey(nameof(FirefighterId))]
    public Firefighter? Firefighter { get; set; }

    public ParticipantStatus Status { get; set; } = ParticipantStatus.Enrolled;

    public bool? Attended { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? Score { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime? CheckInTime { get; set; }

    public DateTime? CheckOutTime { get; set; }
}

public enum ParticipantStatus
{
    Enrolled = 0,
    Completed = 1,
    Dropped = 2,
    Absent = 3
}
