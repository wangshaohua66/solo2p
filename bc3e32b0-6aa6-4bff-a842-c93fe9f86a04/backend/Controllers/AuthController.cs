using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<object>>> Login([FromBody] LoginRequest request)
    {
        try
        {
            var (accessToken, refreshToken, user) = await _authService.LoginAsync(request.Username, request.Password);
            return Ok(ApiResponse<object>.Success(new
            {
                accessToken,
                refreshToken,
                user = new
                {
                    user.Id,
                    user.Username,
                    user.Email,
                    user.Phone,
                    user.Avatar,
                    user.Role,
                    user.MemberTier,
                    user.MemberExpireDate,
                    user.Points,
                    user.TotalSpent
                }
            }));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse.Fail(ex.Message, 401));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<User>>> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var user = await _authService.RegisterAsync(
                request.Username, 
                request.Email, 
                request.Password,
                request.Phone,
                request.MemberTier);
            
            return Ok(ApiResponse<User>.Success(user));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<object>>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request.RefreshToken);
        if (result == null)
            return Unauthorized(ApiResponse.Fail("Refresh token无效或已过期", 401));

        var (accessToken, refreshToken) = result.Value;
        return Ok(ApiResponse<object>.Success(new { accessToken, refreshToken }));
    }

    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse>> Logout()
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            await _authService.LogoutAsync(userId.Value);
        }
        return Ok(ApiResponse.Success("退出成功"));
    }

    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<User>>> GetProfile()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("未登录", 401));

        var user = await _authService.GetUserByIdAsync(userId.Value);
        if (user == null)
            return NotFound(ApiResponse.Fail("用户不存在", 404));

        return Ok(ApiResponse<User>.Success(user));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<User>>> UpdateProfile([FromBody] User profile)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("未登录", 401));

        var user = await _authService.UpdateProfileAsync(userId.Value, profile);
        return Ok(ApiResponse<User>.Success(user));
    }

    [HttpPost("change-password")]
    public async Task<ActionResult<ApiResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("未登录", 401));

        var success = await _authService.ChangePasswordAsync(userId.Value, request.OldPassword, request.NewPassword);
        if (!success)
            return BadRequest(ApiResponse.Fail("原密码错误"));

        return Ok(ApiResponse.Success("密码修改成功"));
    }

    private Guid? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            return null;
        return userId;
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public MemberTier MemberTier { get; set; } = MemberTier.Experience;
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
