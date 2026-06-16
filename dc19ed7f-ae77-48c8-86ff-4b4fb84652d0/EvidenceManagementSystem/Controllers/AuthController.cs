using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
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
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        return Ok(new ApiResponse<LoginResponse>
        {
            Code = 200,
            Message = "登录成功",
            Data = result,
            Timestamp = DateTime.UtcNow
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request);
        return Ok(new ApiResponse<LoginResponse>
        {
            Code = 200,
            Message = "刷新令牌成功",
            Data = result,
            Timestamp = DateTime.UtcNow
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new ApiResponse
            {
                Code = 401,
                Message = "无效的用户信息",
                Timestamp = DateTime.UtcNow
            });
        }

        var result = await _authService.LogoutAsync(userId);
        return Ok(new ApiResponse
        {
            Code = 200,
            Message = "登出成功",
            Timestamp = DateTime.UtcNow
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] CreateUserRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        return StatusCode(201, new ApiResponse<UserDto>
        {
            Code = 201,
            Message = "注册成功",
            Data = result,
            Timestamp = DateTime.UtcNow
        });
    }
}
