using System.Security.Claims;
using EvidenceManagementSystem.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class BaseController : ControllerBase
{
    protected Guid CurrentUserId
    {
        get
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdClaim, out var id) ? id : Guid.Empty;
        }
    }

    protected string CurrentUsername
    {
        get
        {
            return User.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;
        }
    }

    protected int CurrentUserRole
    {
        get
        {
            var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value;
            return int.TryParse(roleClaim, out var role) ? role : 0;
        }
    }

    protected string? CurrentUserRealName
    {
        get
        {
            return User.FindFirst("RealName")?.Value;
        }
    }

    protected IActionResult Success<T>(T data, string message = "操作成功")
    {
        return Ok(new ApiResponse<T>
        {
            Code = 200,
            Message = message,
            Data = data,
            Timestamp = DateTime.UtcNow
        });
    }

    protected IActionResult Success(string message = "操作成功")
    {
        return Ok(new ApiResponse
        {
            Code = 200,
            Message = message,
            Timestamp = DateTime.UtcNow
        });
    }

    protected IActionResult Created<T>(T data, string message = "创建成功")
    {
        return StatusCode(201, new ApiResponse<T>
        {
            Code = 201,
            Message = message,
            Data = data,
            Timestamp = DateTime.UtcNow
        });
    }

    protected IActionResult NotFound(string message = "资源不存在")
    {
        return NotFound(new ApiResponse
        {
            Code = 404,
            Message = message,
            Timestamp = DateTime.UtcNow
        });
    }

    protected IActionResult BadRequest(string message = "请求参数错误")
    {
        return BadRequest(new ApiResponse
        {
            Code = 400,
            Message = message,
            Timestamp = DateTime.UtcNow
        });
    }
}
