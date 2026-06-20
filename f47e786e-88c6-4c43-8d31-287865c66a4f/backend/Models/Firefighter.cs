using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class Firefighter
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? IdNumber { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    public int FireStationId { get; set; }

    [ForeignKey(nameof(FireStationId))]
    public FireStation? FireStation { get; set; }

    public int LevelId { get; set; }

    [ForeignKey(nameof(LevelId))]
    public FirefighterLevel? Level { get; set; }

    public int SpecialtyId { get; set; }

    [ForeignKey(nameof(SpecialtyId))]
    public Specialty? Specialty { get; set; }

    [Column(TypeName = "date")]
    public DateTime HireDate { get; set; }

    [MaxLength(255)]
    public string? Avatar { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
