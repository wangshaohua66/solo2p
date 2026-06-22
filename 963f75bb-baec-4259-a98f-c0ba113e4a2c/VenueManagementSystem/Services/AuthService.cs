using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 用户认证服务实现类
/// 提供用户登录、登出、Token管理、权限验证等功能
/// 支持 200 调度员 + 100 票务管理员并发
/// </summary>
public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<AuthService> _logger;

    private static readonly Dictionary<string, string[]> RolePermissions = new()
    {
        ["Admin"] = new[] { "*" },
        ["VenueManager"] = new[] { "Venue.*", "Event.*", "Schedule.*", "Emergency.*", "Approval.Approve", "Approval.Reject" },
        ["Scheduler"] = new[] { "Schedule.*", "Event.Create", "Event.Update", "Event.Submit", "Emergency.Trigger" },
        ["EventCoordinator"] = new[] { "Event.*", "Schedule.View", "Emergency.Handle" },
        ["TicketAdmin"] = new[] { "Ticket.*", "Report.*" },
        ["SecuritySupervisor"] = new[] { "Emergency.*", "Notification.Broadcast" }
    };

    /// <summary>
    /// 初始化认证服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    public AuthService(
        AppDbContext context,
        IDatabase redis,
        ILogger<AuthService> logger)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 异步用户登录
    /// </summary>
    /// <param name="username">用户名</param>
    /// <param name="password">密码</param>
    /// <returns>登录结果，包含Token和用户信息</returns>
    public async Task<Dictionary<string, object>> LoginAsync(string username, string password)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始用户登录，用户名: {Username}", username);

            if (string.IsNullOrWhiteSpace(username))
                throw new ArgumentException("用户名不能为空", nameof(username));
            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentException("密码不能为空", nameof(password));

            var loginAttemptsKey = $"{RedisKeyPrefix.User}login:attempts:{username}";
            var attempts = await _redis.StringGetAsync(loginAttemptsKey);
            var attemptCount = int.TryParse(attempts, out var count) ? count : 0;

            if (attemptCount >= 5)
            {
                _logger.LogWarning("用户登录尝试次数过多，已被锁定，用户名: {Username}", username);
                throw new InvalidOperationException("登录尝试次数过多，请15分钟后再试");
            }

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

            if (user == null)
            {
                _logger.LogWarning("用户不存在或已禁用，用户名: {Username}", username);
                await IncrementLoginAttempts(loginAttemptsKey);
                throw new UnauthorizedAccessException("用户名或密码错误");
            }

            var passwordValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            if (!passwordValid)
            {
                _logger.LogWarning("密码验证失败，用户名: {Username}", username);
                await IncrementLoginAttempts(loginAttemptsKey);
                throw new UnauthorizedAccessException("用户名或密码错误");
            }

            var token = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken();

            var tokenKey = $"{RedisKeyPrefix.User}token:{user.Id}";
            await _redis.StringSetAsync(tokenKey, refreshToken, TimeSpan.FromDays(7));

            user.LastLoginAt = DateTime.UtcNow;
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            await _redis.KeyDeleteAsync(loginAttemptsKey);

            var result = new Dictionary<string, object>
            {
                ["token"] = token,
                ["refreshToken"] = refreshToken,
                ["expiresIn"] = 3600,
                ["user"] = new
                {
                    id = user.Id,
                    username = user.Username,
                    fullName = user.FullName,
                    email = user.Email,
                    phone = user.Phone,
                    role = user.Role
                }
            };

            var cacheKey = $"{RedisKeyPrefix.User}profile:{user.Id}";
            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(user),
                TimeSpan.FromHours(1));

            _logger.LogInformation("用户登录成功，用户ID: {UserId}，用户名: {Username}，角色: {Role}，耗时: {Elapsed}ms",
                user.Id, user.Username, user.Role, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            throw;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "用户登录失败，用户名: {Username}", username);
            throw new InvalidOperationException("登录失败，请稍后重试", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步用户登出
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>登出是否成功</returns>
    public async Task<bool> LogoutAsync(int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始用户登出，用户ID: {UserId}", userId);

            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var tokenKey = $"{RedisKeyPrefix.User}token:{userId}";
            var profileKey = $"{RedisKeyPrefix.User}profile:{userId}";

            await _redis.KeyDeleteAsync(tokenKey);
            await _redis.KeyDeleteAsync(profileKey);

            _logger.LogInformation("用户登出成功，用户ID: {UserId}，耗时: {Elapsed}ms",
                userId, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "用户登出失败，用户ID: {UserId}", userId);
            return false;
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步刷新访问令牌
    /// </summary>
    /// <param name="refreshToken">刷新令牌</param>
    /// <returns>新的访问令牌</returns>
    public async Task<Dictionary<string, object>> RefreshTokenAsync(string refreshToken)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始刷新访问令牌");

            if (string.IsNullOrWhiteSpace(refreshToken))
                throw new ArgumentException("刷新令牌不能为空", nameof(refreshToken));

            var refreshTokenKey = $"{RedisKeyPrefix.User}refreshtoken:{refreshToken}";
            var userIdStr = await _redis.StringGetAsync(refreshTokenKey);

            if (!userIdStr.HasValue)
            {
                _logger.LogWarning("刷新令牌无效或已过期");
                throw new UnauthorizedAccessException("刷新令牌无效或已过期");
            }

            var userId = int.Parse(userIdStr!);
            var user = await GetCurrentUserAsync(userId);

            if (user == null)
            {
                _logger.LogWarning("用户不存在，用户ID: {UserId}", userId);
                throw new UnauthorizedAccessException("用户不存在");
            }

            var tokenKey = $"{RedisKeyPrefix.User}token:{userId}";
            var storedRefreshToken = await _redis.StringGetAsync(tokenKey);

            if (storedRefreshToken != refreshToken)
            {
                _logger.LogWarning("刷新令牌不匹配，用户ID: {UserId}", userId);
                throw new UnauthorizedAccessException("刷新令牌无效");
            }

            var newToken = GenerateJwtToken(user);
            var newRefreshToken = GenerateRefreshToken();

            await _redis.StringSetAsync(tokenKey, newRefreshToken, TimeSpan.FromDays(7));
            await _redis.KeyDeleteAsync(refreshTokenKey);
            await _redis.StringSetAsync($"{RedisKeyPrefix.User}refreshtoken:{newRefreshToken}", userId.ToString(), TimeSpan.FromDays(7));

            var result = new Dictionary<string, object>
            {
                ["token"] = newToken,
                ["refreshToken"] = newRefreshToken,
                ["expiresIn"] = 3600
            };

            _logger.LogInformation("访问令牌刷新成功，用户ID: {UserId}，耗时: {Elapsed}ms",
                userId, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "刷新访问令牌失败");
            throw new InvalidOperationException("刷新令牌失败，请重新登录", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取当前用户信息
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>用户信息</returns>
    public async Task<User?> GetCurrentUserAsync(int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var cacheKey = $"{RedisKeyPrefix.User}profile:{userId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedUser = Newtonsoft.Json.JsonConvert.DeserializeObject<User>(cachedData!);
                if (cachedUser != null)
                {
                    _logger.LogDebug("从Redis缓存获取用户信息成功，用户ID: {UserId}", userId);
                    return cachedUser;
                }
            }

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user != null)
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(user),
                    TimeSpan.FromHours(1));
            }

            return user;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取用户信息失败，用户ID: {UserId}", userId);
            throw new InvalidOperationException("获取用户信息失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 验证用户权限
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <param name="permission">所需权限</param>
    /// <returns>是否有权限</returns>
    public async Task<bool> ValidatePermissionAsync(int userId, string permission)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));
            if (string.IsNullOrWhiteSpace(permission))
                throw new ArgumentException("权限不能为空", nameof(permission));

            var cacheKey = $"{RedisKeyPrefix.User}permission:{userId}:{permission}";
            var cachedResult = await _redis.StringGetAsync(cacheKey);

            if (cachedResult.HasValue && bool.TryParse(cachedResult!, out var hasPermission))
            {
                _logger.LogDebug("从Redis缓存获取权限验证结果，用户ID: {UserId}，权限: {Permission}，结果: {Result}",
                    userId, permission, hasPermission);
                return hasPermission;
            }

            var user = await GetCurrentUserAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("用户不存在，无法验证权限，用户ID: {UserId}", userId);
                return false;
            }

            var result = CheckRolePermission(user.Role, permission);

            await _redis.StringSetAsync(cacheKey,
                result.ToString(),
                TimeSpan.FromMinutes(30));

            _logger.LogDebug("权限验证完成，用户ID: {UserId}，角色: {Role}，权限: {Permission}，结果: {Result}，耗时: {Elapsed}ms",
                userId, user.Role, permission, result, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "验证用户权限失败，用户ID: {UserId}，权限: {Permission}", userId, permission);
            return false;
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 检查角色权限
    /// </summary>
    /// <param name="role">用户角色</param>
    /// <param name="permission">所需权限</param>
    /// <returns>是否有权限</returns>
    private static bool CheckRolePermission(string role, string permission)
    {
        if (string.IsNullOrWhiteSpace(role))
            return false;

        if (!RolePermissions.TryGetValue(role, out var permissions))
            return false;

        foreach (var perm in permissions)
        {
            if (perm == "*")
                return true;

            if (perm.EndsWith(".*"))
            {
                var prefix = perm[..^2];
                if (permission.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            else if (string.Equals(perm, permission, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 生成JWT访问令牌
    /// </summary>
    /// <param name="user">用户信息</param>
    /// <returns>JWT令牌字符串</returns>
    private static string GenerateJwtToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes("ThisIsAStrongSecretKeyForJwtTokenGeneration123456");
        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    /// <summary>
    /// 生成刷新令牌
    /// </summary>
    /// <returns>刷新令牌字符串</returns>
    private static string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    /// <summary>
    /// 增加登录尝试次数
    /// </summary>
    /// <param name="key">Redis键</param>
    private async Task IncrementLoginAttempts(string key)
    {
        await _redis.StringIncrementAsync(key);
        await _redis.KeyExpireAsync(key, TimeSpan.FromMinutes(15));
    }
}
