using System;

namespace WaterDispatch.Core.Entities;

public enum UserRole
{
    DispatchDirector = 1,
    Dispatcher = 2,
    RepairLeader = 3,
    Inspector = 4
}

public class UserAccount
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string? Phone { get; set; }
    public string? District { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastLoginTime { get; set; }
    public DateTime CreatedAt { get; set; }
}
