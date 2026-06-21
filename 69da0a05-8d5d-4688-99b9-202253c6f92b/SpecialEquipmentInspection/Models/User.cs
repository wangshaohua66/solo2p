using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class User
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    [Required]
    [StringLength(32)]
    public string RealName { get; set; } = string.Empty;

    [StringLength(32)]
    public string UseUnitCode { get; set; } = string.Empty;

    public int? InspectorId { get; set; }

    [StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
