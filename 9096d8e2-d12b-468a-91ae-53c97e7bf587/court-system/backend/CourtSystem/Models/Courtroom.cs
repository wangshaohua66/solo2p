using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CourtSystem.Models;

/// <summary>
/// 法庭实体
/// </summary>
[Table("courtrooms")]
[Index(nameof(CourtId), nameof(Name), IsUnique = true)]
public class Courtroom
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("court_id")]
    public long CourtId { get; set; }

    [ForeignKey(nameof(CourtId))]
    public Court Court { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("location")]
    public string? Location { get; set; }

    [Column("capacity")]
    public int Capacity { get; set; } = 30;

    [MaxLength(50)]
    [Column("equipment_level")]
    public string EquipmentLevel { get; set; } = "STANDARD";

    [MaxLength(500)]
    [Column("features")]
    public string? Features { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Hearing> Hearings { get; set; } = new List<Hearing>();
}
