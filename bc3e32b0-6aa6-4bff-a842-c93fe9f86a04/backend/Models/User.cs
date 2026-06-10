namespace PotteryStudio.Models;

public enum UserRole
{
    Admin,
    Instructor,
    Member,
    Guest
}

public enum MemberTier
{
    Experience,
    Monthly,
    Quarterly,
    Yearly
}

public class MemberTierBenefit
{
    public MemberTier Tier { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int KilnPriority { get; set; }
    public int GlazeRecipesUnlocked { get; set; }
    public decimal CourseDiscount { get; set; }
    public decimal Price { get; set; }
    public int FreeHoursPerMonth { get; set; }
}

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public UserRole Role { get; set; } = UserRole.Member;
    public MemberTier MemberTier { get; set; } = MemberTier.Experience;
    public DateTime? MemberExpireDate { get; set; }
    public decimal TotalSpent { get; set; }
    public int Points { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public ICollection<PieceArchive> Pieces { get; set; } = new List<PieceArchive>();
    public ICollection<CourseRegistration> CourseRegistrations { get; set; } = new List<CourseRegistration>();
    public ICollection<StudioBooking> StudioBookings { get; set; } = new List<StudioBooking>();
    public ICollection<CustomOrder> CustomOrders { get; set; } = new List<CustomOrder>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
