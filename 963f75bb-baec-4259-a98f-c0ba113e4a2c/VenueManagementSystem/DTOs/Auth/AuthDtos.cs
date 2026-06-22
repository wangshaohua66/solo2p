using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Auth;

/// <summary>
/// 用户登录请求 DTO
/// </summary>
public class LoginRequestDto
{
    /// <summary>
    /// 用户名
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// 密码
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// 是否记住我
    /// </summary>
    public bool RememberMe { get; set; } = false;
}

/// <summary>
/// 用户登录响应 DTO
/// </summary>
public class LoginResponseDto
{
    /// <summary>
    /// 访问令牌
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// 刷新令牌
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// 令牌类型
    /// </summary>
    public string TokenType { get; set; } = "Bearer";

    /// <summary>
    /// 过期时间（秒）
    /// </summary>
    public int ExpiresIn { get; set; }

    /// <summary>
    /// 用户信息
    /// </summary>
    public UserProfileDto User { get; set; } = new UserProfileDto();
}

/// <summary>
/// 刷新令牌请求 DTO
/// </summary>
public class RefreshTokenRequestDto
{
    /// <summary>
    /// 刷新令牌
    /// </summary>
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// 用户信息 DTO
/// </summary>
public class UserProfileDto
{
    /// <summary>
    /// 用户ID
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// 用户名
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// 全名
    /// </summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// 邮箱
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// 电话
    /// </summary>
    public string Phone { get; set; } = string.Empty;

    /// <summary>
    /// 角色
    /// </summary>
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// 权限列表
    /// </summary>
    public List<string> Permissions { get; set; } = new List<string>();

    /// <summary>
    /// 最后登录时间
    /// </summary>
    public DateTime? LastLoginAt { get; set; }
}

/// <summary>
/// 用户登出请求 DTO
/// </summary>
public class LogoutRequestDto
{
    /// <summary>
    /// 刷新令牌（可选）
    /// </summary>
    public string? RefreshToken { get; set; }
}
