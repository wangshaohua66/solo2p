using System.ComponentModel.DataAnnotations;

namespace FireTraining.Models;

public class Room
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public RoomType Type { get; set; }

    public int Capacity { get; set; }

    [MaxLength(100)]
    public string? Building { get; set; }

    [MaxLength(50)]
    public string? Floor { get; set; }

    [MaxLength(500)]
    public string? Equipment { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<TrainingSchedule>? Schedules { get; set; }
}

public enum RoomType
{
    Classroom = 1,
    TrainingField = 2,
    MultiPurpose = 3
}
