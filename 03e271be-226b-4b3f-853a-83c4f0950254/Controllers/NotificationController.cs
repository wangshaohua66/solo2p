using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Background;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationController : BaseController
{
    private readonly INotificationService _notificationService;

    public NotificationController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet("list")]
    public async Task<IActionResult> List([FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
    {
        var user = HttpContext.RequireCurrentUser();
        var (items, totalCount) = await _notificationService.GetNotificationsAsync(user.Id, pageIndex, pageSize);
        var paged = new Models.PagedResult<NotificationRecord>
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
        return Success(paged);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var user = HttpContext.RequireCurrentUser();
        await _notificationService.MarkAsReadAsync(id, user.Id);
        return Success("已标记为已读");
    }
}
