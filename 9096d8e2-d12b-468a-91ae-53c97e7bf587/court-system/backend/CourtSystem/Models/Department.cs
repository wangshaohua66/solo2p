using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CourtSystem.Models;

/// <summary>
/// 部门（审判庭）实体
/// </summary>
[Table("departments")]
public class Department
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
    [MaxLength(100)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("department_type")]
    public string DepartmentType { get; set; } = "CIVIL";

    [Column("parent_department_id")]
    public long? ParentDepartmentId { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
}
