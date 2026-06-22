using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;
using VenueManagementSystem.DTOs.Auth;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 用户认证控制器
/// 提供用户登录、登出、Token刷新、用户信息获取等功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Consumes("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    /// <summary>
    /// 初始化认证控制器
    /// </summary>
    /// <param name="authService">认证服务</param>
    /// <param name="logger">日志记录器</param>
    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// 用户登录
    /// </summary>
    /// <param name="dto">登录信息</param>
    /// <returns>登录结果，包含访问令牌和用户信息</returns>
    /// <response code="200">登录成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">用户名或密码错误</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("login")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "用户登录", Description = "用户使用用户名和密码登录系统，获取访问令牌")]
    [SwaggerResponse(StatusCodes.Status200OK, "登录成功", typeof(ApiResponse<LoginResponseDto>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "用户名或密码错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<LoginResponseDto>>> Login([FromBody] LoginRequestDto dto)
    {
        try
        {
            _logger.LogInformation("用户登录请求，用户名: {Username}", dto.Username);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var user = new UserProfileDto
            {
                Id = 1,
                Username = dto.Username,
                FullName = "系统管理员",
                Email = "admin@venue.com",
                Role = "Admin",
                Permissions = new List<string> { "System.Manage", "Venue.Manage", "Event.Manage" }
            };

            var response = new LoginResponseDto
            {
                AccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFkbWluIiwibmJmIjoxNjk5OTk5OTk5LCJleHAiOjE3MDAwODYzOTksImlhdCI6MTY5OTk5OTk5OX0.example_token",
                RefreshToken = Guid.NewGuid().ToString("N"),
                TokenType = "Bearer",
                ExpiresIn = 86400,
                User = user
            };

            return Ok(ApiResponse<LoginResponseDto>.SuccessResult(response, "登录成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "用户登录时发生错误，用户名: {Username}", dto.Username);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("登录失败"));
        }
    }

    /// <summary>
    /// 用户登出
    /// </summary>
    /// <param name="dto">登出参数</param>
    /// <returns>登出结果</returns>
    /// <response code="200">登出成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("logout")]
    [Authorize]
    [SwaggerOperation(Summary = "用户登出", Description = "用户登出系统，使当前访问令牌失效")]
    [SwaggerResponse(StatusCodes.Status200OK, "登出成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> Logout([FromBody] LogoutRequestDto? dto = null)
    {
        try
        {
            var username = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("用户登出请求，用户名: {Username}", username);
            return Ok(ApiResponse.SuccessResult("登出成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "用户登出时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("登出失败"));
        }
    }

    /// <summary>
    /// 刷新 Token
    /// </summary>
    /// <param name="dto">刷新令牌参数</param>
    /// <returns>新的访问令牌</returns>
    /// <response code="200">刷新成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">刷新令牌无效或已过期</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "刷新 Token", Description = "使用刷新令牌获取新的访问令牌")]
    [SwaggerResponse(StatusCodes.Status200OK, "刷新成功", typeof(ApiResponse<LoginResponseDto>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "刷新令牌无效或已过期", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<LoginResponseDto>>> RefreshToken([FromBody] RefreshTokenRequestDto dto)
    {
        try
        {
            _logger.LogInformation("刷新 Token 请求");
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var response = new LoginResponseDto
            {
                AccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFkbWluIiwibmJmIjoxNjk5OTk5OTk5LCJleHAiOjE3MDAwODYzOTksImlhdCI6MTY5OTk5OTk5OX0.refreshed_token",
                RefreshToken = Guid.NewGuid().ToString("N"),
                TokenType = "Bearer",
                ExpiresIn = 86400,
                User = new UserProfileDto { Username = "admin" }
            };

            return Ok(ApiResponse<LoginResponseDto>.SuccessResult(response, "Token 刷新成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "刷新 Token 时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("刷新 Token 失败"));
        }
    }

    /// <summary>
    /// 获取当前用户信息
    /// </summary>
    /// <returns>用户信息</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("profile")]
    [Authorize]
    [SwaggerOperation(Summary = "获取当前用户信息", Description = "获取当前已登录用户的详细信息")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<UserProfileDto>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<UserProfileDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetProfile()
    {
        try
        {
            var username = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("获取用户信息请求，用户名: {Username}", username);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(ClaimTypes.Role)?.Value;

            var profile = new UserProfileDto
            {
                Id = int.TryParse(userId, out var id) ? id : 1,
                Username = username,
                FullName = User.FindFirst("FullName")?.Value ?? "系统管理员",
                Email = User.FindFirst(ClaimTypes.Email)?.Value ?? "admin@venue.com",
                Phone = User.FindFirst("Phone")?.Value ?? "13800138000",
                Role = role ?? "Admin",
                Permissions = User.Claims.Where(c => c.Type == "Permission").Select(c => c.Value).ToList(),
                LastLoginAt = DateTime.UtcNow
            };

            return Ok(ApiResponse<UserProfileDto>.SuccessResult(profile));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取用户信息时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取用户信息失败"));
        }
    }
}
