using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class LearningProgress
{
    [Key]
    public int Id { get; set; }

    public int FirefighterId { get; set; }

    [ForeignKey(nameof(FirefighterId))]
    public Firefighter? Firefighter { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public int SpecialtyId { get; set; }

    [ForeignKey(nameof(SpecialtyId))]
    public Specialty? Specialty { get; set; }

    [Column(TypeName = "date")]
    public DateTime CycleStartDate { get; set; }

    [Column(TypeName = "date")]
    public DateTime CycleEndDate { get; set; }

    public decimal CompletedTheoryHours { get; set; }

    public decimal RequiredTheoryHours { get; set; }

    public int CompletedPracticalCount { get; set; }

    public int RequiredPracticalCount { get; set; }

    public int ExamsPassed { get; set; }

    public int ExamsRequired { get; set; }

    public decimal OverallProgressPercentage { get; set; }

    public ProgressStatus Status { get; set; } = ProgressStatus.InProgress;

    public bool IsAtRisk { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<LearningProgressDetail>? Details { get; set; }
}

public enum ProgressStatus
{
    NotStarted = 0,
    InProgress = 1,
    Warning = 2,
    Completed = 3,
    Failed = 4
}

public class LearningProgressDetail
{
    [Key]
    public int Id { get; set; }

    public int LearningProgressId { get; set; }

    [ForeignKey(nameof(LearningProgressId))]
    public LearningProgress? LearningProgress { get; set; }

    public int CourseId { get; set; }

    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    public int? TrainingScheduleId { get; set; }

    [ForeignKey(nameof(TrainingScheduleId))]
    public TrainingSchedule? TrainingSchedule { get; set; }

    public ProgressItemType ItemType { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal HoursCompleted { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal HoursRequired { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletionDate { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? Score { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public enum ProgressItemType
{
    TheoryCourse = 1,
    PracticalTraining = 2,
    Exam = 3
}

public class StatisticFilter
{
    public int? SpecialtyId { get; set; }
    public int? LevelId { get; set; }
    public int? FireStationId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public StatisticPeriod Period { get; set; } = StatisticPeriod.Monthly;
}

public enum StatisticPeriod
{
    Daily = 0,
    Weekly = 1,
    Monthly = 2,
    Quarterly = 3,
    Yearly = 4
}

public class TrainingStatistics
{
    public decimal TrainingCoverage { get; set; }
    public decimal AverageHours { get; set; }
    public int TotalParticipants { get; set; }
    public int TotalCourses { get; set; }
    public int CompletedCourses { get; set; }
    public List<StationStatistic>? ByStation { get; set; }
    public List<LevelStatistic>? ByLevel { get; set; }
    public List<SpecialtyStatistic>? BySpecialty { get; set; }
    public List<PeriodStatistic>? TrendData { get; set; }
}

public class ExamStatistics
{
    public decimal PassRate { get; set; }
    public decimal AverageScore { get; set; }
    public int TotalExams { get; set; }
    public int TotalParticipants { get; set; }
    public int PassedCount { get; set; }
    public int FailedCount { get; set; }
    public List<StationStatistic>? ByStation { get; set; }
    public List<LevelStatistic>? ByLevel { get; set; }
    public List<SpecialtyStatistic>? BySpecialty { get; set; }
    public List<PeriodStatistic>? TrendData { get; set; }
}

public class EquipmentStatistics
{
    public decimal UtilizationRate { get; set; }
    public int TotalEquipment { get; set; }
    public int AvailableEquipment { get; set; }
    public int MaintenanceEquipment { get; set; }
    public int TotalReservations { get; set; }
    public int ApprovedReservations { get; set; }
    public int OverdueCount { get; set; }
    public List<EquipmentUsageRanking>? UsageRanking { get; set; }
    public List<PeriodStatistic>? TrendData { get; set; }
}

public class StationStatistic
{
    public int StationId { get; set; }
    public string? StationName { get; set; }
    public int FirefighterCount { get; set; }
    public decimal CoverageRate { get; set; }
    public decimal PassRate { get; set; }
    public decimal? AverageHours { get; set; }
}

public class LevelStatistic
{
    public int LevelId { get; set; }
    public string? LevelName { get; set; }
    public int Count { get; set; }
    public decimal PassRate { get; set; }
    public decimal CoverageRate { get; set; }
}

public class SpecialtyStatistic
{
    public int SpecialtyId { get; set; }
    public string? SpecialtyName { get; set; }
    public int Count { get; set; }
    public decimal? UtilizationRate { get; set; }
    public decimal? PassRate { get; set; }
}

public class PeriodStatistic
{
    public string? PeriodLabel { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal? CoverageRate { get; set; }
    public decimal? PassRate { get; set; }
    public decimal? UtilizationRate { get; set; }
    public int? ParticipantCount { get; set; }
}

public class EquipmentUsageRanking
{
    public int EquipmentId { get; set; }
    public string? EquipmentName { get; set; }
    public string? Category { get; set; }
    public int TotalQuantity { get; set; }
    public int UsageCount { get; set; }
    public decimal UsageRate { get; set; }
}
