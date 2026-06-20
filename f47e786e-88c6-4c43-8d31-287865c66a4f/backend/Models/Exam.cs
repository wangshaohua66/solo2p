using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class Exam
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public ExamType Type { get; set; }

    public int SpecialtyId { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public int? ExamPaperId { get; set; }

    [ForeignKey(nameof(ExamPaperId))]
    public ExamPaper? ExamPaper { get; set; }

    public int? PracticalExamId { get; set; }

    [ForeignKey(nameof(PracticalExamId))]
    public PracticalExam? PracticalExam { get; set; }

    [Column(TypeName = "date")]
    public DateTime ExamDate { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int? RoomId { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    public int PassScore { get; set; } = 60;

    public int TotalScore { get; set; } = 100;

    public ExamStatus Status { get; set; } = ExamStatus.Draft;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<ExamScore>? Scores { get; set; }
}

public enum ExamType
{
    Theory = 1,
    Practical = 2,
    Comprehensive = 3
}

public enum ExamStatus
{
    Draft = 0,
    Published = 1,
    InProgress = 2,
    Grading = 3,
    Completed = 4,
    Cancelled = 5
}

public class ExamScore
{
    [Key]
    public int Id { get; set; }

    public int ExamId { get; set; }

    [ForeignKey(nameof(ExamId))]
    public Exam? Exam { get; set; }

    public int FirefighterId { get; set; }

    [ForeignKey(nameof(FirefighterId))]
    public Firefighter? Firefighter { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? TheoryScore { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? PracticalScore { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal TotalScore { get; set; }

    public ExamResultStatus Status { get; set; }

    public int? Rank { get; set; }

    [MaxLength(1000)]
    public string? Comments { get; set; }

    public bool? NeedsReassessment { get; set; }

    public int? GradedBy { get; set; }

    public DateTime? GradedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<PracticalScoreItem>? PracticalScoreItems { get; set; }
}

public enum ExamResultStatus
{
    NotStarted = 0,
    InProgress = 1,
    Submitted = 2,
    Passed = 3,
    Failed = 4,
    Reassessment = 5
}
