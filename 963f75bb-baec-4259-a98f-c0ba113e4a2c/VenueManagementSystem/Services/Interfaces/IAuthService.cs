using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 认证服务接口
/// 提供用户登录、注册、Token 生成、权限验证等功能
/// 支持200调度员 + 100票务管理员并发
/// </summary>
public interface IAuthService : IServiceBase
{
    /// <summary>
    /// 异步用户登录
    /// </summary>
    /// <param name="username">用户名</param>
    /// <param name="password">密码</param>
    /// <returns>登录结果，包含Token和用户信息</returns>
    Task<Dictionary<string, object>> LoginAsync(string username, string password);

    /// <summary>
    /// 异步用户登出
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>登出是否成功</returns>
    Task<bool> LogoutAsync(int userId);

    /// <summary>
    /// 异步刷新访问令牌
    /// </summary>
    /// <param name="refreshToken">刷新令牌</param>
    /// <returns>新的访问令牌</returns>
    Task<Dictionary<string, object>> RefreshTokenAsync(string refreshToken);

    /// <summary>
    /// 异步获取当前用户信息
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>用户信息</returns>
    Task<User?> GetCurrentUserAsync(int userId);

    /// <summary>
    /// 验证用户权限
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <param name="permission">所需权限</param>
    /// <returns>是否有权限</returns>
    Task<bool> ValidatePermissionAsync(int userId, string permission);
}
