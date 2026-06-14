using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BlueprintReview.Configuration;
using BlueprintReview.Data;
using BlueprintReview.DTOs;
using BlueprintReview.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;

namespace BlueprintReview.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<User?> GetUserByIdAsync(string userId);
    Task<User?> GetUserByEmailAsync(string email);
    Task<UserDto?> GetCurrentUserAsync(string userId);
    string GenerateJwtToken(User user);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}

public class AuthService : IAuthService
{
    private readonly IMongoDbContext _dbContext;
    private readonly JwtSettings _jwtSettings;

    public AuthService(IMongoDbContext dbContext, IOptions<JwtSettings> jwtSettings)
    {
        _dbContext = dbContext;
        _jwtSettings = jwtSettings.Value;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await GetUserByEmailAsync(request.Email);
        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return null;
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedAccessException("账户已被禁用");
        }

        var token = GenerateJwtToken(user);

        return new LoginResponse
        {
            Token = token,
            User = MapToUserDto(user)
        };
    }

    public async Task<User?> GetUserByIdAsync(string userId)
    {
        return await _dbContext.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _dbContext.Users.Find(u => u.Email == email.ToLower()).FirstOrDefaultAsync();
    }

    public async Task<UserDto?> GetCurrentUserAsync(string userId)
    {
        var user = await GetUserByIdAsync(userId);
        return user == null ? null : MapToUserDto(user);
    }

    public string GenerateJwtToken(User user)
    {
        var key = Encoding.ASCII.GetBytes(_jwtSettings.Secret);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            }),
            Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            )
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Avatar = user.Avatar,
            Role = user.Role,
            Department = user.Department
        };
    }

    public async Task SeedDefaultUsersAsync()
    {
        var existingUsers = await _dbContext.Users.CountDocumentsAsync(_ => true);
        if (existingUsers > 0) return;

        var defaultUsers = new List<User>
        {
            new()
            {
                Name = "项目经理",
                Email = "pm@demo.com",
                PasswordHash = HashPassword("123456"),
                Role = UserRole.ProjectManager,
                Department = "项目管理部"
            },
            new()
            {
                Name = "张设计",
                Email = "designer@demo.com",
                PasswordHash = HashPassword("123456"),
                Role = UserRole.Designer,
                Department = "建筑设计部"
            },
            new()
            {
                Name = "李审阅",
                Email = "reviewer@demo.com",
                PasswordHash = HashPassword("123456"),
                Role = UserRole.Reviewer,
                Department = "质量审查部"
            }
        };

        await _dbContext.Users.InsertManyAsync(defaultUsers);
    }
}
