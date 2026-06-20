using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class Course
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int SpecialtyId { get; set; }

    [ForeignKey(nameof(SpecialtyId))]
    public Specialty? Specialty { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public int DurationHours { get; set; }

    public CourseType Type { get; set; }

    public LocationType DefaultLocationType { get; set; }

    public int? DefaultRoomId { get; set; }

    [MaxLength(200)]
    public string? Instructor { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<TrainingSchedule>? Schedules { get; set; }
}

public enum CourseType
{
    Theory = 1,
    Practical = 2,
    Comprehensive = 3
}

public enum LocationType
{
    Classroom = 1,
    TrainingField = 2
}
