using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Services;

public interface IAuthService
{
    Task<TokenResponse> LoginAsync(LoginRequest request);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IJwtService _jwtService;

    public AuthService(AppDbContext db, IJwtService jwtService)
    {
        _db = db;
        _jwtService = jwtService;
    }

    public async Task<TokenResponse> LoginAsync(LoginRequest request)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == request.Username);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new BusinessException("用户名或密码错误", 401);
        }

        var token = _jwtService.GenerateToken(user);
        return new TokenResponse
        {
            AccessToken = token,
            ExpiresIn = 720 * 60,
            User = new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                RealName = user.RealName,
                Role = user.Role,
                UseUnitCode = user.UseUnitCode,
                InspectorId = user.InspectorId
            }
        };
    }
}
