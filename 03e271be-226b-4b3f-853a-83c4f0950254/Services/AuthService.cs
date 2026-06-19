using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Middleware;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<UserDto?> GetUserByIdAsync(int id);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IJwtUtils _jwtUtils;

    public AuthService(AppDbContext dbContext, IJwtUtils jwtUtils)
    {
        _dbContext = dbContext;
        _jwtUtils = jwtUtils;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await _dbContext.Users
            .Include(u => u.Mine)
            .FirstOrDefaultAsync(u => u.Username == request.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("用户名或密码错误");
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedAccessException("账号已被禁用");
        }

        var token = _jwtUtils.GenerateToken(user);

        return new LoginResponse
        {
            Token = token,
            UserId = user.Id,
            Username = user.Username,
            RealName = user.RealName,
            Role = user.Role,
            MineId = user.MineId
        };
    }

    public async Task<UserDto?> GetUserByIdAsync(int id)
    {
        var user = await _dbContext.Users
            .Include(u => u.Mine)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return null;

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            RealName = user.RealName,
            Role = user.Role,
            Phone = user.Phone,
            Email = user.Email,
            MineId = user.MineId,
            MineName = user.Mine?.Name,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }
}
