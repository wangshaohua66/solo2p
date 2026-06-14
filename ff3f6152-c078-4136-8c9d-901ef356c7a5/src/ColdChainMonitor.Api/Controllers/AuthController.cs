using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ColdChainMonitor.Application.Services;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly AuditService _auditService;

    public AuthController(AuthService authService, AuditService auditService)
    {
        _authService = authService;
        _auditService = auditService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ApiResponse<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.LoginAsync(request, ipAddress);

        if (result == null)
        {
            await _auditService.LogAsync(
                AuditActionType.Login,
                "登录失败",
                "Auth",
                operatorId: request.Username,
                ipAddress: ipAddress,
                status: false,
                errorMessage: "用户名或密码错误");

            return ApiResponse<LoginResponse>.Error(1001, "用户名或密码错误");
        }

        await _auditService.LogAsync(
            AuditActionType.Login,
            "登录成功",
            "Auth",
            operatorId: result.User.Id,
            operatorName: result.User.RealName,
            operatorRole: result.User.Role,
            ipAddress: ipAddress,
            status: true);

        return ApiResponse<LoginResponse>.Success(result);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ApiResponse<LoginResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.RefreshTokenAsync(request.RefreshToken, ipAddress);

        if (result == null)
        {
            return ApiResponse<LoginResponse>.Error(1002, "刷新令牌无效或已过期");
        }

        return ApiResponse<LoginResponse>.Success(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<ApiResponse> Logout([FromBody] RefreshTokenRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        await _authService.LogoutAsync(request.RefreshToken, ipAddress);

        await _auditService.LogAsync(
            AuditActionType.Logout,
            "登出",
            "Auth",
            operatorId: userId,
            operatorName: userName,
            ipAddress: ipAddress,
            status: true);

        return ApiResponse.Success("登出成功");
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ApiResponse<UserInfoDto>> GetUserInfo()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return ApiResponse<UserInfoDto>.Error(1003, "用户未认证");
        }

        var user = await _authService.GetUserInfoAsync(userId);
        if (user == null)
        {
            return ApiResponse<UserInfoDto>.Error(1004, "用户不存在");
        }

        return ApiResponse<UserInfoDto>.Success(user);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ApiResponse> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return ApiResponse.Error(1003, "用户未认证");
        }

        var result = await _authService.ChangePasswordAsync(userId, request.OldPassword, request.NewPassword);
        if (!result)
        {
            return ApiResponse.Error(1005, "原密码错误");
        }

        await _auditService.LogAsync(
            AuditActionType.Update,
            "修改密码",
            "Auth",
            entityType: "User",
            entityId: userId,
            operatorId: userId,
            operatorName: userName,
            status: true);

        return ApiResponse.Success("密码修改成功");
    }

    [HttpPost("users")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<UserInfoDto>> CreateUser([FromBody] CreateUserRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        try
        {
            var user = await _authService.CreateUserAsync(request, userId!);

            await _auditService.LogAsync(
                AuditActionType.Create,
                "创建用户",
                "User",
                entityType: "User",
                entityId: user.Id,
                operatorId: userId,
                operatorName: userName,
                status: true);

            return ApiResponse<UserInfoDto>.Success(user);
        }
        catch (InvalidOperationException ex)
        {
            return ApiResponse<UserInfoDto>.Error(1006, ex.Message);
        }
    }

    [HttpPut("users/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<UserInfoDto>> UpdateUser(string id, [FromBody] UpdateUserRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var user = await _authService.UpdateUserAsync(id, request);
        if (user == null)
        {
            return ApiResponse<UserInfoDto>.Error(1004, "用户不存在");
        }

        await _auditService.LogAsync(
            AuditActionType.Update,
            "更新用户",
            "User",
            entityType: "User",
            entityId: id,
            operatorId: operatorId,
            operatorName: operatorName,
            status: true);

        return ApiResponse<UserInfoDto>.Success(user);
    }
}
