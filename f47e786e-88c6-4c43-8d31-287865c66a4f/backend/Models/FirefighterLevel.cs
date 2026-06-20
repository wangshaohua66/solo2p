using System.ComponentModel.DataAnnotations;

namespace FireTraining.Models;

public class FirefighterLevel
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Color { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(200)]
    public string? Description { get; set; }

    public int RequiredTheoryHours { get; set; }

    public int RequiredPracticalCount { get; set; }

    public int RequiredExamScore { get; set; } = 80;

    public bool IsActive { get; set; } = true;
}
