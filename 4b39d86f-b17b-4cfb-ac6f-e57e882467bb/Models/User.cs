using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string RealName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string IdCard { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.Enterprise;

    public int? EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise? Enterprise { get; set; }

    [MaxLength(50)]
    public string? Department { get; set; }

    [MaxLength(50)]
    public string? Position { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginTime { get; set; }

    [MaxLength(50)]
    public string? LastLoginIp { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
}

public enum UserRole
{
    Admin = 1,
    Supervisor = 2,
    Enterprise = 3,
    Driver = 4,
    Inspector = 5,
    Viewer = 99
}
