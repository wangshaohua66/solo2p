using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class AuthService
{
    private readonly IUserRepository _userRepository;
    private readonly JwtSettings _jwtSettings;

    public AuthService(IUserRepository userRepository, IOptions<JwtSettings> jwtSettings)
    {
        _userRepository = userRepository;
        _jwtSettings = jwtSettings.Value;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, string? ipAddress = null)
    {
        var passwordHash = HashPassword(request.Password);
        var user = await _userRepository.GetByUsernameAndPasswordAsync(request.Username, passwordHash);

        if (user == null || !user.IsActive)
            return null;

        await _userRepository.UpdateLastLoginAsync(user.Id, DateTime.UtcNow);

        var accessToken = GenerateAccessToken(user);
        var refreshToken = GenerateRefreshToken();

        await _userRepository.CreateRefreshTokenAsync(new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpiryDays),
            IsRevoked = false,
            IpAddress = ipAddress
        });

        return new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = _jwtSettings.AccessTokenExpirySeconds,
            User = MapToUserInfoDto(user)
        };
    }

    public async Task<LoginResponse?> RefreshTokenAsync(string refreshToken, string? ipAddress = null)
    {
        var storedToken = await _userRepository.GetRefreshTokenAsync(refreshToken);
        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt <= DateTime.UtcNow)
            return null;

        var user = await _userRepository.GetByIdAsync(storedToken.UserId);
        if (user == null || !user.IsActive)
            return null;

        await _userRepository.RevokeRefreshTokenAsync(refreshToken, ipAddress);

        var newAccessToken = GenerateAccessToken(user);
        var newRefreshToken = GenerateRefreshToken();

        await _userRepository.CreateRefreshTokenAsync(new RefreshToken
        {
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpiryDays),
            IsRevoked = false,
            IpAddress = ipAddress
        });

        return new LoginResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            ExpiresIn = _jwtSettings.AccessTokenExpirySeconds,
            User = MapToUserInfoDto(user)
        };
    }

    public async Task LogoutAsync(string refreshToken, string? ipAddress = null)
    {
        await _userRepository.RevokeRefreshTokenAsync(refreshToken, ipAddress);
    }

    public async Task<bool> ChangePasswordAsync(string userId, string oldPassword, string newPassword)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return false;

        var oldHash = HashPassword(oldPassword);
        if (user.PasswordHash != oldHash) return false;

        var newHash = HashPassword(newPassword);
        await _userRepository.UpdatePasswordAsync(userId, newHash);

        await _userRepository.RevokeAllUserRefreshTokensAsync(userId);
        return true;
    }

    public async Task<UserInfoDto?> GetUserInfoAsync(string userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        return user == null ? null : MapToUserInfoDto(user);
    }

    public async Task<UserInfoDto> CreateUserAsync(CreateUserRequest request, string createdBy)
    {
        var existingUser = await _userRepository.GetByUsernameAsync(request.Username);
        if (existingUser != null)
            throw new InvalidOperationException("用户名已存在");

        var user = new User
        {
            Username = request.Username,
            PasswordHash = HashPassword(request.Password),
            RealName = request.RealName,
            Phone = request.Phone,
            Email = request.Email,
            Role = request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);
        return MapToUserInfoDto(user);
    }

    public async Task<UserInfoDto?> UpdateUserAsync(string userId, UpdateUserRequest request)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(request.RealName))
            user.RealName = request.RealName;
        if (request.Phone != null)
            user.Phone = request.Phone;
        if (request.Email != null)
            user.Email = request.Email;
        if (request.Role.HasValue)
            user.Role = request.Role.Value;
        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(userId, user);

        return MapToUserInfoDto(user);
    }

    private string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("realName", user.RealName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(_jwtSettings.AccessTokenExpirySeconds),
            signingCredentials: creds
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

    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var builder = new StringBuilder();
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }

    private static UserInfoDto MapToUserInfoDto(User user)
    {
        return new UserInfoDto
        {
            Id = user.Id,
            Username = user.Username,
            RealName = user.RealName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            LastLoginAt = user.LastLoginAt
        };
    }
}

public class JwtSettings
{
    public string Secret { get; set; } = "YourSuperSecretKeyForJwtTokenGenerationAtLeast32Characters";
    public string Issuer { get; set; } = "ColdChainMonitor";
    public string Audience { get; set; } = "ColdChainMonitorUsers";
    public int AccessTokenExpirySeconds { get; set; } = 7200;
    public int RefreshTokenExpiryDays { get; set; } = 7;
}
