using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly JwtSettings _jwtSettings;

    public AuthService(AppDbContext context, IOptions<JwtSettings> jwtSettings)
    {
        _context = context;
        _jwtSettings = jwtSettings.Value;
    }

    public async Task<(string accessToken, string refreshToken, User user)> LoginAsync(string username, string password)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => (u.Username == username || u.Email == username) && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("用户名或密码错误");
        }

        var accessToken = GenerateAccessToken(user);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return (accessToken, refreshToken, user);
    }

    public async Task<User> RegisterAsync(string username, string email, string password, string? phone, MemberTier tier)
    {
        if (await _context.Users.AnyAsync(u => u.Username == username))
            throw new InvalidOperationException("用户名已存在");

        if (await _context.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("邮箱已注册");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            Phone = phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Member,
            MemberTier = tier,
            MemberExpireDate = tier == MemberTier.Experience ? null : 
                tier == MemberTier.Monthly ? DateTime.UtcNow.AddMonths(1) :
                tier == MemberTier.Quarterly ? DateTime.UtcNow.AddMonths(3) :
                DateTime.UtcNow.AddYears(1),
            TotalSpent = 0,
            Points = 0,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        var welcomeNotification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Title = "欢迎加入陶艺工坊",
            Content = "感谢您的注册，期待与您一起探索陶艺的魅力！",
            Type = NotificationType.System,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(welcomeNotification);

        await _context.SaveChangesAsync();
        return user;
    }

    public async Task<(string accessToken, string refreshToken)?> RefreshTokenAsync(string refreshToken)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken && u.RefreshTokenExpiry > DateTime.UtcNow);

        if (user == null)
            return null;

        var newAccessToken = GenerateAccessToken(user);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return (newAccessToken, newRefreshToken);
    }

    public async Task LogoutAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<User?> GetUserByIdAsync(Guid userId)
    {
        return await _context.Users.FindAsync(userId);
    }

    public async Task<User> UpdateProfileAsync(Guid userId, User profile)
    {
        var user = await _context.Users.FindAsync(userId) 
            ?? throw new InvalidOperationException("用户不存在");

        if (!string.IsNullOrEmpty(profile.Phone))
            user.Phone = profile.Phone;
        
        if (!string.IsNullOrEmpty(profile.Avatar))
            user.Avatar = profile.Avatar;

        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return user;
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string oldPassword, string newPassword)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        if (!BCrypt.Net.BCrypt.Verify(oldPassword, user.PasswordHash))
            return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    private string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("memberTier", user.MemberTier.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
}
