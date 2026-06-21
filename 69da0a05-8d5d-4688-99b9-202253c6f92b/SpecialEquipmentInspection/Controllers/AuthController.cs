using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Services;

namespace SpecialEquipmentInspection.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    public AuthController(IAuthService authService) => _authService = authService;

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ApiResponse<TokenResponse>> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        return ApiResponse<TokenResponse>.Ok(result, "登录成功");
    }
}
