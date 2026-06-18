using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[SwaggerTag("认证管理 - 用户登录、Token获取")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "用户登录", Description = "使用用户名和密码登录，获取JWT Token")]
    [SwaggerResponse(200, "登录成功", typeof(ApiResponse<LoginResponse>))]
    [SwaggerResponse(400, "用户名或密码错误")]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest dto)
    {
        var result = await _authService.LoginAsync(dto);
        return Ok(result);
    }

    [HttpGet("userinfo")]
    [SwaggerOperation(Summary = "获取当前用户信息", Description = "从Token中解析用户信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<UserInfoDto>))]
    [SwaggerResponse(401, "未授权")]
    public async Task<ActionResult<ApiResponse<UserInfoDto>>> GetUserInfo()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized(new ApiResponse<UserInfoDto> { Code = 401, Message = "未授权访问" });
        }

        var userInfo = await _authService.GetUserInfoAsync(userId);
        if (userInfo == null)
        {
            return NotFound(new ApiResponse<UserInfoDto> { Code = 404, Message = "用户不存在" });
        }

        return Ok(new ApiResponse<UserInfoDto> { Data = userInfo });
    }
}
