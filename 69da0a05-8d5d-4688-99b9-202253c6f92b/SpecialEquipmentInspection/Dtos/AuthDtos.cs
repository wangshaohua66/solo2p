using System.ComponentModel.DataAnnotations;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Dtos;

public class LoginRequest
{
    [Required(ErrorMessage = "用户名不能为空")]
    [StringLength(32)]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码不能为空")]
    [StringLength(64, MinimumLength = 6, ErrorMessage = "密码长度需在6-64位之间")]
    public string Password { get; set; } = string.Empty;
}

public class TokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
    public UserProfileDto User { get; set; } = new();
}

public class UserProfileDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string UseUnitCode { get; set; } = string.Empty;
    public int? InspectorId { get; set; }
}
