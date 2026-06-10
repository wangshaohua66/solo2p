using PotteryStudio.Models;

namespace PotteryStudio.Services;

public interface IAuthService
{
    Task<(string accessToken, string refreshToken, User user)> LoginAsync(string username, string password);
    Task<User> RegisterAsync(string username, string email, string password, string? phone, MemberTier tier);
    Task<(string accessToken, string refreshToken)?> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(Guid userId);
    Task<User?> GetUserByIdAsync(Guid userId);
    Task<User> UpdateProfileAsync(Guid userId, User profile);
    Task<bool> ChangePasswordAsync(Guid userId, string oldPassword, string newPassword);
}

public interface IMemberService
{
    Task<PagedResult<User>> GetMembersAsync(PagedQuery query, MemberTier? tier = null);
    Task<User?> GetMemberByIdAsync(Guid id);
    Task<User> CreateMemberAsync(User user, string password);
    Task<User> UpdateMemberAsync(Guid id, User user);
    Task DeleteMemberAsync(Guid id);
    Task<User> UpgradeTierAsync(Guid memberId, MemberTier tier, int durationMonths);
    Task<MemberTierBenefit[]> GetTierBenefitsAsync();
    Task<PagedResult<PieceArchive>> GetMemberPiecesAsync(Guid memberId, PagedQuery query);
    Task<PagedResult<CourseRegistration>> GetMemberCoursesAsync(Guid memberId, PagedQuery query);
    Task<(int points, decimal totalHours)> GetMemberPointsAsync(Guid memberId);
    Task CheckMembershipExpiryAsync();
}
