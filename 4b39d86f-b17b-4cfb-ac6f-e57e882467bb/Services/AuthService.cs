using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HazChemSupervision.Services;

public class AuthService : IAuthService
{
    private readonly IBaseRepository<User> _userRepo;
    private readonly IConfiguration _config;
    private readonly IMapper _mapper;

    public AuthService(IBaseRepository<User> userRepo, IConfiguration config, IMapper mapper)
    {
        _userRepo = userRepo;
        _config = config;
        _mapper = mapper;
    }

    public async Task<ApiResponse<LoginResponse>> LoginAsync(LoginRequest dto)
    {
        var user = await _userRepo.FirstOrDefaultAsync(u =>
            u.Username == dto.Username && u.IsActive);

        if (user == null)
        {
            return new ApiResponse<LoginResponse>
            {
                Code = 401,
                Message = "用户名或密码错误"
            };
        }

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            return new ApiResponse<LoginResponse>
            {
                Code = 401,
                Message = "用户名或密码错误"
            };
        }

        user.LastLoginTime = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);

        var token = await GenerateTokenAsync(user);
        var userInfo = _mapper.Map<UserInfoDto>(user);

        return new ApiResponse<LoginResponse>
        {
            Code = 200,
            Message = "登录成功",
            Data = new LoginResponse
            {
                Token = token,
                TokenType = "Bearer",
                ExpiresIn = _config.GetValue<int>("Jwt:ExpireMinutes", 1440) * 60,
                User = userInfo
            }
        };
    }

    public async Task<UserInfoDto?> GetUserInfoAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        return user != null ? _mapper.Map<UserInfoDto>(user) : null;
    }

    public async Task<bool> ValidateTokenAsync(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "HazChemSupervision_SecretKey_2024_VeryLongSecurityKeyForJWT");

        try
        {
            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _config["Jwt:Issuer"] ?? "HazChemSupervision",
                ValidAudience = _config["Jwt:Audience"] ?? "HazChemSupervisionUsers",
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ClockSkew = TimeSpan.Zero
            }, out _);

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<string> GenerateTokenAsync(User user)
    {
        var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "HazChemSupervision_SecretKey_2024_VeryLongSecurityKeyForJWT");
        var issuer = _config["Jwt:Issuer"] ?? "HazChemSupervision";
        var audience = _config["Jwt:Audience"] ?? "HazChemSupervisionUsers";
        var expireMinutes = _config.GetValue<int>("Jwt:ExpireMinutes", 1440);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("RealName", user.RealName),
            new Claim("EnterpriseId", user.EnterpriseId?.ToString() ?? "0")
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(expireMinutes),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return await Task.FromResult(tokenHandler.WriteToken(token));
    }
}
