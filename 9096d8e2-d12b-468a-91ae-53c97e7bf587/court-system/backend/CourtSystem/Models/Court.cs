using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CourtSystem.Models;

/// <summary>
/// 法院实体
/// </summary>
[Table("courts")]
public class Court
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [MaxLength(20)]
    [Column("level")]
    public string Level { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("address")]
    public string? Address { get; set; }

    [Column("parent_court_id")]
    public long? ParentCourtId { get; set; }

    [ForeignKey(nameof(ParentCourtId))]
    public Court? ParentCourt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Court> ChildCourts { get; set; } = new List<Court>();
    public ICollection<Courtroom> Courtrooms { get; set; } = new List<Courtroom>();
    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<Case> Cases { get; set; } = new List<Case>();
}
