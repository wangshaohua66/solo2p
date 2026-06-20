using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Auth;

public class LoginDto
{
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResultDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public long Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public UserRole Role { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public long? FireStationId { get; set; }
    public string? FireStationName { get; set; }
    public long? FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? DistrictCode { get; set; }
    public bool IsActive { get; set; }
}

public class UserCreateDto
{
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public UserRole Role { get; set; }
    public long? FireStationId { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public string? Description { get; set; }
}

public class UserUpdateDto
{
    public string? RealName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public UserRole? Role { get; set; }
    public long? FireStationId { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsActive { get; set; }
    public string? Description { get; set; }
}

public class ChangePasswordDto
{
    public long UserId { get; set; }
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UserQueryDto : PagedQuery
{
    public UserRole? Role { get; set; }
    public long? FireStationId { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsActive { get; set; }
}
