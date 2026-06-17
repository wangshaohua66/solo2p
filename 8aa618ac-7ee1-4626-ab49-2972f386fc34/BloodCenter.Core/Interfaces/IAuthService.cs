using BloodCenter.Infrastructure.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);
    Task<AuthResponseDto> RefreshTokenAsync(RefreshTokenRequestDto request, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> ValidateSecondaryTokenAsync(Guid userId, string secondaryToken, CancellationToken cancellationToken = default);
    Task<string> GenerateSecondaryTokenAsync(Guid userId, CancellationToken cancellationToken = default);
}

public record LoginRequestDto(string UserName, string Password);
public record RefreshTokenRequestDto(string AccessToken, string RefreshToken);
public record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserRole Role, string UserName, Guid UserId);
