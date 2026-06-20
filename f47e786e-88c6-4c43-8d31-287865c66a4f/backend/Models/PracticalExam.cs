using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class PracticalExam
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public int SpecialtyId { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public int TotalScore { get; set; } = 100;

    public int PassScore { get; set; } = 80;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? EquipmentRequired { get; set; }

    public int? EstimatedDurationMinutes { get; set; }

    [MaxLength(2000)]
    public string? EvaluationCriteria { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<PracticalExamItem>? Items { get; set; }

    public ICollection<Exam>? Exams { get; set; }
}

public class PracticalExamItem
{
    [Key]
    public int Id { get; set; }

    public int PracticalExamId { get; set; }

    [ForeignKey(nameof(PracticalExamId))]
    public PracticalExam? PracticalExam { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int Weight { get; set; }

    public int MaxScore { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(500)]
    public string? ScoringGuide { get; set; }

    public bool IsDeductionItem { get; set; }

    public decimal? MinScore { get; set; }

    public ICollection<PracticalScoreItem>? ScoreItems { get; set; }
}

public class PracticalScoreItem
{
    [Key]
    public int Id { get; set; }

    public int ExamScoreId { get; set; }

    [ForeignKey(nameof(ExamScoreId))]
    public ExamScore? ExamScore { get; set; }

    public int PracticalExamItemId { get; set; }

    [ForeignKey(nameof(PracticalExamItemId))]
    public PracticalExamItem? PracticalExamItem { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal Score { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public int? GradedBy { get; set; }

    public DateTime? GradedAt { get; set; }

    [MaxLength(2000)]
    public string? ScoreTrail { get; set; }
}
