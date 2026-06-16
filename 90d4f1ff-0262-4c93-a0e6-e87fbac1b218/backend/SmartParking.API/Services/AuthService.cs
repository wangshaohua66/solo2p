using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(AppDbContext db, IMapper mapper, IConfiguration config, ILogger<AuthService> logger)
    {
        _db = db;
        _mapper = mapper;
        _config = config;
        _logger = logger;
    }

    public async Task<ApiResponse<LoginResponse>> LoginAsync(LoginRequest request)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username && !u.IsDeleted);
            if (user == null)
                return ApiResponse<LoginResponse>.Error("用户名或密码错误", 401);

            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return ApiResponse<LoginResponse>.Error("用户名或密码错误", 401);

            var token = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken();
            var expireMinutes = int.Parse(_config["Jwt:ExpireMinutes"] ?? "1440");
            var refreshExpireDays = int.Parse(_config["Jwt:RefreshTokenExpireDays"] ?? "7");

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(refreshExpireDays);
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("用户 {Username} 登录成功", user.Username);

            return ApiResponse<LoginResponse>.Success(new LoginResponse
            {
                Token = token,
                RefreshToken = refreshToken,
                User = _mapper.Map<UserDto>(user),
                ExpiresIn = expireMinutes * 60
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "登录失败");
            return ApiResponse<LoginResponse>.Error("登录失败");
        }
    }

    public async Task<ApiResponse<LoginResponse>> RefreshTokenAsync(RefreshTokenRequest request)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken && !u.IsDeleted);
            if (user == null || user.RefreshTokenExpires < DateTime.UtcNow)
                return ApiResponse<LoginResponse>.Error("Refresh token 已失效", 401);

            var token = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken();
            var expireMinutes = int.Parse(_config["Jwt:ExpireMinutes"] ?? "1440");
            var refreshExpireDays = int.Parse(_config["Jwt:RefreshTokenExpireDays"] ?? "7");

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(refreshExpireDays);
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return ApiResponse<LoginResponse>.Success(new LoginResponse
            {
                Token = token,
                RefreshToken = refreshToken,
                User = _mapper.Map<UserDto>(user),
                ExpiresIn = expireMinutes * 60
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "刷新 token 失败");
            return ApiResponse<LoginResponse>.Error("刷新失败", 401);
        }
    }

    public async Task<ApiResponse<UserDto>> GetProfileAsync(string userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null || user.IsDeleted)
            return ApiResponse<UserDto>.Error("用户不存在", 404);
        return ApiResponse<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<ApiResponse> LogoutAsync(string userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpires = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        return ApiResponse.Ok();
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Secret"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature);
        var expireMinutes = int.Parse(_config["Jwt:ExpireMinutes"] ?? "1440");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("UserId", user.Id),
            new Claim("Role", user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expireMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        return $"{Guid.NewGuid():N}{Guid.NewGuid():N}";
    }
}
