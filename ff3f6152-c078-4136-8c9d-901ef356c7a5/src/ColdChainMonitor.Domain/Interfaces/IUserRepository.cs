using ColdChainMonitor.Domain.Models;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByUsernameAndPasswordAsync(string username, string passwordHash);
    Task UpdateLastLoginAsync(string userId, DateTime loginTime);
    Task UpdatePasswordAsync(string userId, string passwordHash);
    Task CreateRefreshTokenAsync(RefreshToken refreshToken);
    Task<RefreshToken?> GetRefreshTokenAsync(string token);
    Task RevokeRefreshTokenAsync(string token, string? ipAddress = null);
    Task RevokeAllUserRefreshTokensAsync(string userId);
}
