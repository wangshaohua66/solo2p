using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class User : BaseEntity
{
    public string UserName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordSalt { get; set; }
    public string RealName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public UserRole Role { get; set; } = UserRole.Inspector;
    public long? FireStationId { get; set; }
    public long? FireUnitId { get; set; }
    public string? AvatarUrl { get; set; }
    public string? DistrictCode { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    public string? LastLoginIp { get; set; }
    public string? Description { get; set; }

    public FireStation? FireStation { get; set; }
    public FireUnit? FireUnit { get; set; }
}
