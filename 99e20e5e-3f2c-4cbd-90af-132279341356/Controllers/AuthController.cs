using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Auth;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ApiResponse<LoginResultDto>> Login([FromBody] LoginDto dto)
    {
        return await _authService.LoginAsync(dto);
    }

    [HttpGet("users/{id}")]
    public async Task<ApiResponse<UserDto>> GetUserById(long id)
    {
        return await _authService.GetUserByIdAsync(id);
    }

    [HttpGet("users")]
    public async Task<ApiResponse<PagedResult<UserDto>>> GetUsers([FromQuery] UserQueryDto query)
    {
        return await _authService.GetUsersPagedAsync(query);
    }

    [HttpPost("users")]
    public async Task<ApiResponse<UserDto>> CreateUser([FromBody] UserCreateDto dto)
    {
        return await _authService.CreateUserAsync(dto);
    }

    [HttpPut("users/{id}")]
    public async Task<ApiResponse<bool>> UpdateUser(long id, [FromBody] UserUpdateDto dto)
    {
        return await _authService.UpdateUserAsync(id, dto);
    }

    [HttpDelete("users/{id}")]
    public async Task<ApiResponse<bool>> DeleteUser(long id)
    {
        return await _authService.DeleteUserAsync(id);
    }

    [HttpPost("users/change-password")]
    public async Task<ApiResponse<bool>> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        return await _authService.ChangePasswordAsync(dto);
    }

    [HttpPost("users/{id}/reset-password")]
    public async Task<ApiResponse<bool>> ResetPassword(long id, [FromBody] string newPassword)
    {
        return await _authService.ResetPasswordAsync(id, newPassword);
    }
}
