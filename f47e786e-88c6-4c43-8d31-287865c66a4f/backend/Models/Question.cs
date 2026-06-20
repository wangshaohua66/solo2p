using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class Question
{
    [Key]
    public int Id { get; set; }

    public QuestionType Type { get; set; }

    public int CategoryId { get; set; }

    [ForeignKey(nameof(CategoryId))]
    public QuestionCategory? Category { get; set; }

    public DifficultyLevel Difficulty { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public string? OptionsJson { get; set; }

    public string? Answer { get; set; }

    public int Score { get; set; } = 2;

    [MaxLength(500)]
    public string? Analysis { get; set; }

    [MaxLength(255)]
    public string? ImageUrl { get; set; }

    [MaxLength(255)]
    public string? KnowledgePoints { get; set; }

    public int UseCount { get; set; } = 0;

    public int CorrectCount { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

public enum QuestionType
{
    Single = 1,
    Multiple = 2,
    Judge = 3,
    Scenario = 4
}

public enum DifficultyLevel
{
    Easy = 1,
    Medium = 2,
    Hard = 3
}

public class QuestionCategory
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public int? ParentId { get; set; }

    [ForeignKey(nameof(ParentId))]
    public QuestionCategory? Parent { get; set; }

    public int SpecialtyId { get; set; }

    [ForeignKey(nameof(SpecialtyId))]
    public Specialty? Specialty { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<QuestionCategory>? Children { get; set; }

    public ICollection<Question>? Questions { get; set; }
}
