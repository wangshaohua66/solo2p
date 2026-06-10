using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using CampHub.Models;

namespace CampHub.Services;

public class JwtService
{
    private readonly JwtSettings _jwt;
    private readonly MongoContext _db;

    public JwtService(IOptions<JwtSettings> jwt, MongoContext db)
    {
        _jwt = jwt.Value;
        _db = db;
    }

    public async Task<AuthResponseDto> GenerateAuthResponse(User user)
    {
        var accessToken = GenerateAccessToken(user);
        var refreshToken = await GenerateRefreshToken(user);

        await RevokeOldRefreshTokens(user.Id);
        user.CurrentRefreshTokenId = refreshToken.Id;
        await _db.Users.FindOneAndUpdateAsync(
            u => u.Id == user.Id,
            Builders<User>.Update.Set(u => u.CurrentRefreshTokenId, refreshToken.Id));

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresIn = _jwt.AccessTokenExpirationMinutes * 60,
            User = MapToUserDto(user)
        };
    }

    public string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name, user.Nickname)
        };

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwt.AccessTokenExpirationMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<RefreshToken> GenerateRefreshToken(User user)
    {
        var rt = new RefreshToken
        {
            UserId = user.Id,
            Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenExpirationDays),
            Revoked = false
        };
        await _db.RefreshTokens.InsertOneAsync(rt);
        return rt;
    }

    public async Task<AuthResponseDto?> RefreshAccessToken(string tokenStr)
    {
        var rt = await _db.RefreshTokens
            .Find(r => r.Token == tokenStr && !r.Revoked && r.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();

        if (rt == null) return null;

        var user = await _db.Users.Find(u => u.Id == rt.UserId).FirstOrDefaultAsync();
        if (user == null || user.CurrentRefreshTokenId != rt.Id) return null;

        var newAccessToken = GenerateAccessToken(user);
        var newRt = await GenerateRefreshToken(user);

        rt.Revoked = true;
        await _db.RefreshTokens.FindOneAndReplaceAsync(r => r.Id == rt.Id, rt);
        user.CurrentRefreshTokenId = newRt.Id;
        await _db.Users.FindOneAndReplaceAsync(u => u.Id == user.Id, user);

        return new AuthResponseDto
        {
            AccessToken = newAccessToken,
            RefreshToken = newRt.Token,
            ExpiresIn = _jwt.AccessTokenExpirationMinutes * 60,
            User = MapToUserDto(user)
        };
    }

    public async Task<bool> RevokeRefreshToken(string userId)
    {
        var update = Builders<RefreshToken>.Update.Set(r => r.Revoked, true);
        var result = await _db.RefreshTokens.UpdateManyAsync(
            r => r.UserId == userId && !r.Revoked, update);
        return result.ModifiedCount > 0;
    }

    private async Task RevokeOldRefreshTokens(string userId)
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        await _db.RefreshTokens.DeleteManyAsync(r => r.UserId == userId && r.ExpiresAt < cutoff);
    }

    public static string? GetUserIdFromClaims(ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true) return null;
        var sub = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (!string.IsNullOrEmpty(sub)) return sub;
        return user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    public static UserDto MapToUserDto(User u) => new()
    {
        Id = u.Id,
        Email = u.Email,
        Nickname = u.Nickname,
        AvatarUrl = u.AvatarUrl,
        CreditScore = u.CreditScore
    };

    public static async Task<UserDto?> GetUserDtoById(MongoContext db, string? id)
    {
        if (string.IsNullOrEmpty(id)) return null;
        var u = await db.Users.Find(x => x.Id == id).FirstOrDefaultAsync();
        return u == null ? null : MapToUserDto(u);
    }
}
