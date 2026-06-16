namespace ColdChainLogistics.Models.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public UserRole Role { get; set; }
    public long? CustomerId { get; set; }
    public bool IsActive { get; set; } = true;
    public string? LastLoginIp { get; set; }
    public DateTime? LastLoginTime { get; set; }

    public Customer? Customer { get; set; }
}
