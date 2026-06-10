using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class MemberService : IMemberService
{
    private readonly AppDbContext _context;

    public MemberService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<User>> GetMembersAsync(PagedQuery query, MemberTier? tier = null)
    {
        var queryable = _context.Users.Where(u => u.Role == UserRole.Member && u.IsActive);

        if (tier.HasValue)
            queryable = queryable.Where(u => u.MemberTier == tier.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(u => 
                u.Username.ToLower().Contains(keyword) ||
                u.Email.ToLower().Contains(keyword) ||
                (u.Phone != null && u.Phone.Contains(keyword)));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(u => u.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<User?> GetMemberByIdAsync(Guid id)
    {
        return await _context.Users
            .Include(u => u.Pieces)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<User> CreateMemberAsync(User user, string password)
    {
        if (await _context.Users.AnyAsync(u => u.Username == user.Username))
            throw new InvalidOperationException("用户名已存在");

        user.Id = Guid.NewGuid();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.Role = UserRole.Member;
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        user.IsActive = true;

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user;
    }

    public async Task<User> UpdateMemberAsync(Guid id, User user)
    {
        var existing = await _context.Users.FindAsync(id) 
            ?? throw new InvalidOperationException("会员不存在");

        existing.Username = user.Username;
        existing.Email = user.Email;
        existing.Phone = user.Phone;
        existing.MemberTier = user.MemberTier;
        existing.MemberExpireDate = user.MemberExpireDate;
        existing.Points = user.Points;
        existing.TotalSpent = user.TotalSpent;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteMemberAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id) 
            ?? throw new InvalidOperationException("会员不存在");

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task<User> UpgradeTierAsync(Guid memberId, MemberTier tier, int durationMonths)
    {
        var user = await _context.Users.FindAsync(memberId)
            ?? throw new InvalidOperationException("会员不存在");

        var currentExpiry = user.MemberExpireDate ?? DateTime.UtcNow;
        var newExpiry = currentExpiry > DateTime.UtcNow 
            ? currentExpiry.AddMonths(durationMonths)
            : DateTime.UtcNow.AddMonths(durationMonths);

        user.MemberTier = tier;
        user.MemberExpireDate = newExpiry;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return user;
    }

    public Task<MemberTierBenefit[]> GetTierBenefitsAsync()
    {
        var benefits = new[]
        {
            new MemberTierBenefit
            {
                Tier = MemberTier.Experience,
                Name = "experience",
                DisplayName = "体验卡",
                KilnPriority = 0,
                GlazeRecipesUnlocked = 5,
                CourseDiscount = 0m,
                FreeHoursPerMonth = 0,
                Price = 0
            },
            new MemberTierBenefit
            {
                Tier = MemberTier.Monthly,
                Name = "monthly",
                DisplayName = "月卡",
                KilnPriority = 1,
                GlazeRecipesUnlocked = 20,
                CourseDiscount = 0.1m,
                FreeHoursPerMonth = 10,
                Price = 299
            },
            new MemberTierBenefit
            {
                Tier = MemberTier.Quarterly,
                Name = "quarterly",
                DisplayName = "季卡",
                KilnPriority = 2,
                GlazeRecipesUnlocked = 50,
                CourseDiscount = 0.2m,
                FreeHoursPerMonth = 20,
                Price = 799
            },
            new MemberTierBenefit
            {
                Tier = MemberTier.Yearly,
                Name = "yearly",
                DisplayName = "年卡",
                KilnPriority = 3,
                GlazeRecipesUnlocked = -1,
                CourseDiscount = 0.3m,
                FreeHoursPerMonth = 40,
                Price = 2999
            }
        };

        return Task.FromResult(benefits);
    }

    public async Task<PagedResult<PieceArchive>> GetMemberPiecesAsync(Guid memberId, PagedQuery query)
    {
        var queryable = _context.PieceArchives.Where(p => p.MemberId == memberId);
        var totalCount = await queryable.CountAsync();
        
        var items = await queryable
            .OrderByDescending(p => p.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .Include(p => p.Photos)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<PagedResult<CourseRegistration>> GetMemberCoursesAsync(Guid memberId, PagedQuery query)
    {
        var queryable = _context.CourseRegistrations.Where(cr => cr.MemberId == memberId);
        var totalCount = await queryable.CountAsync();
        
        var items = await queryable
            .OrderByDescending(cr => cr.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .Include(cr => cr.Course)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<(int points, decimal totalHours)> GetMemberPointsAsync(Guid memberId)
    {
        var user = await _context.Users.FindAsync(memberId)
            ?? throw new InvalidOperationException("会员不存在");

        var totalHours = await _context.StudioBookings
            .Where(sb => sb.MemberId == memberId && sb.Status == BookingStatus.Completed)
            .SumAsync(sb => sb.ActualHours ?? 0);

        return (user.Points, totalHours);
    }

    public async Task CheckMembershipExpiryAsync()
    {
        var warningDays = 14;
        var warningDate = DateTime.UtcNow.AddDays(warningDays);

        var expiringMembers = await _context.Users
            .Where(u => u.Role == UserRole.Member 
                && u.MemberExpireDate.HasValue 
                && u.MemberExpireDate.Value <= warningDate
                && u.MemberExpireDate.Value > DateTime.UtcNow
                && u.IsActive)
            .ToListAsync();

        foreach (var member in expiringMembers)
        {
            var existingNotification = await _context.Notifications
                .AnyAsync(n => n.UserId == member.Id 
                    && n.Type == NotificationType.Membership 
                    && n.Title.Contains("续费提醒")
                    && n.CreatedAt >= DateTime.UtcNow.AddDays(-1));

            if (!existingNotification)
            {
                var daysLeft = (member.MemberExpireDate.Value - DateTime.UtcNow).Days;
                _context.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = member.Id,
                    Title = "会员续费提醒",
                    Content = $"您的会员将在 {daysLeft} 天后到期，请及时续费。",
                    Type = NotificationType.Membership,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();
    }
}
