using System.Security.Claims;
using BlueprintReview.DTOs;
using BlueprintReview.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlueprintReview.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
    {
        try
        {
            var result = await _authService.LoginAsync(request);
            if (result == null)
            {
                return Unauthorized(ApiResponse<LoginResponse>.Error("邮箱或密码错误", 401));
            }
            return Ok(ApiResponse<LoginResponse>.Success(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse<LoginResponse>.Error(ex.Message, 401));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed");
            return StatusCode(500, ApiResponse<LoginResponse>.Error("登录失败"));
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public ActionResult<ApiResponse> Logout()
    {
        return Ok(ApiResponse.Success("已退出登录"));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
        {
            return Unauthorized(ApiResponse<UserDto>.Error("未认证", 401));
        }

        var user = await _authService.GetCurrentUserAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserDto>.Error("用户不存在", 404));
        }

        return Ok(ApiResponse<UserDto>.Success(user));
    }

    [HttpPost("refresh")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> RefreshToken()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
        {
            return Unauthorized(ApiResponse<object>.Error("未认证", 401));
        }

        var user = await _authService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<object>.Error("用户不存在", 404));
        }

        var newToken = _authService.GenerateJwtToken(user);
        return Ok(ApiResponse<object>.Success(new { Token = newToken }));
    }
}
