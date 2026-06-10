using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Notification>>>> GetMyNotifications(
        [FromQuery] bool? isRead = null,
        [FromQuery] int limit = 50)
    {
        var userId = GetCurrentUserId();
        var notifications = await _notificationService.GetUserNotificationsAsync(userId, isRead, limit);
        return Ok(ApiResponse<List<Notification>>.Success(notifications));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(ApiResponse<int>.Success(count));
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult<ApiResponse>> MarkAsRead(Guid id)
    {
        await _notificationService.MarkAsReadAsync(id);
        return Ok(ApiResponse.Success("已标记为已读"));
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<ApiResponse>> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();
        await _notificationService.MarkAllAsReadAsync(userId);
        return Ok(ApiResponse.Success("全部已读"));
    }

    private Guid GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            throw new UnauthorizedAccessException();
        return userId;
    }
}
