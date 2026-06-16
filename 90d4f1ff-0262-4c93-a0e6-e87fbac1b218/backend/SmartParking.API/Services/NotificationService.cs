using Microsoft.AspNetCore.SignalR;
using SmartParking.API.Hubs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IHubContext<NotificationHub> hub, ILogger<NotificationService> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyUserAsync(string userId, string message, string type = "info")
    {
        try
        {
            await _hub.Clients.Group($"user:{userId}").SendAsync("Notification", message, type);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "发送用户通知失败 userId={UserId}", userId);
        }
    }

    public async Task NotifyAllAsync(string message, string type = "info")
    {
        try
        {
            await _hub.Clients.All.SendAsync("Notification", message, type);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "发送全局通知失败");
        }
    }
}
