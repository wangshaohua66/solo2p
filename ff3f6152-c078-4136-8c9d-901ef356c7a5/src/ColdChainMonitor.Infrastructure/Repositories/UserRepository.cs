using MongoDB.Driver;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class UserRepository : MongoRepositoryBase<User>, IUserRepository
{
    private readonly IMongoCollection<RefreshToken> _refreshTokenCollection;

    public UserRepository(MongoDbContext context)
        : base(context, context.Users)
    {
        _refreshTokenCollection = context.RefreshTokens;
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Username, username);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<User?> GetByUsernameAndPasswordAsync(string username, string passwordHash)
    {
        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(u => u.Username, username),
            Builders<User>.Filter.Eq(u => u.PasswordHash, passwordHash)
        );
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task UpdateLastLoginAsync(string userId, DateTime loginTime)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, userId);
        var update = Builders<User>.Update
            .Set(u => u.LastLoginAt, loginTime)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task UpdatePasswordAsync(string userId, string passwordHash)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, userId);
        var update = Builders<User>.Update
            .Set(u => u.PasswordHash, passwordHash)
            .Set(u => u.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task CreateRefreshTokenAsync(RefreshToken refreshToken)
    {
        await _refreshTokenCollection.InsertOneAsync(refreshToken);
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(t => t.Token, token);
        return await _refreshTokenCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task RevokeRefreshTokenAsync(string token, string? ipAddress = null)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(t => t.Token, token);
        var update = Builders<RefreshToken>.Update
            .Set(t => t.IsRevoked, true)
            .Set(t => t.RevokedAt, DateTime.UtcNow)
            .Set(t => t.IpAddress, ipAddress);
        await _refreshTokenCollection.UpdateOneAsync(filter, update);
    }

    public async Task RevokeAllUserRefreshTokensAsync(string userId)
    {
        var filter = Builders<RefreshToken>.Filter.And(
            Builders<RefreshToken>.Filter.Eq(t => t.UserId, userId),
            Builders<RefreshToken>.Filter.Eq(t => t.IsRevoked, false)
        );
        var update = Builders<RefreshToken>.Update
            .Set(t => t.IsRevoked, true)
            .Set(t => t.RevokedAt, DateTime.UtcNow);
        await _refreshTokenCollection.UpdateManyAsync(filter, update);
    }
}
