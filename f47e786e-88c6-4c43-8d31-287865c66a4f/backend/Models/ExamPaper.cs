using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class ExamPaper
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public int SpecialtyId { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public PaperType Type { get; set; }

    public char? PaperVersion { get; set; }

    public int TotalScore { get; set; } = 100;

    public int QuestionCount { get; set; }

    public int PassScore { get; set; } = 60;

    public int DurationMinutes { get; set; } = 90;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public PaperStatus Status { get; set; } = PaperStatus.Draft;

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<ExamPaperQuestion>? PaperQuestions { get; set; }

    public ICollection<Exam>? Exams { get; set; }
}

public enum PaperType
{
    Theory = 1,
    Practical = 2,
    Comprehensive = 3
}

public enum PaperStatus
{
    Draft = 0,
    Published = 1,
    Archived = 2,
    Disabled = 3
}

public class ExamPaperQuestion
{
    [Key]
    public int Id { get; set; }

    public int ExamPaperId { get; set; }

    [ForeignKey(nameof(ExamPaperId))]
    public ExamPaper? ExamPaper { get; set; }

    public int QuestionId { get; set; }

    [ForeignKey(nameof(QuestionId))]
    public Question? Question { get; set; }

    public int SortOrder { get; set; }

    public int Score { get; set; }

    public QuestionType QuestionType { get; set; }
}

public class PaperGenerationConfig
{
    public int SpecialtyId { get; set; }
    public int LevelId { get; set; }
    public int TotalScore { get; set; } = 100;
    public int QuestionCount { get; set; } = 50;
    public int PassScore { get; set; } = 60;
    public int DurationMinutes { get; set; } = 90;
    public bool GenerateABPaper { get; set; } = true;
    public DifficultyDistribution DifficultyDistribution { get; set; } = new();
    public QuestionTypeDistribution TypeDistribution { get; set; } = new();
    public List<int>? CategoryIds { get; set; }
}

public class DifficultyDistribution
{
    public int EasyPercentage { get; set; } = 30;
    public int MediumPercentage { get; set; } = 50;
    public int HardPercentage { get; set; } = 20;
}

public class QuestionTypeDistribution
{
    public int SinglePercentage { get; set; } = 40;
    public int MultiplePercentage { get; set; } = 30;
    public int JudgePercentage { get; set; } = 20;
    public int ScenarioPercentage { get; set; } = 10;
}
