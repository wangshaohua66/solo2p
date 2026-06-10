using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Services;

public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Notification>> GetUserNotificationsAsync(Guid userId, bool? isRead = null, int limit = 50)
    {
        var query = _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit);

        if (isRead.HasValue)
            query = (IOrderedQueryable<Notification>)query.Where(n => n.IsRead == isRead.Value);

        return await query.ToListAsync();
    }

    public async Task<Notification> CreateNotificationAsync(
        Guid userId, 
        string title, 
        string content, 
        NotificationType type = NotificationType.System,
        string? link = null)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Content = content,
            Type = type,
            IsRead = false,
            Link = link,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();
        return notification;
    }

    public async Task MarkAsReadAsync(Guid notificationId)
    {
        var notification = await _context.Notifications.FindAsync(notificationId);
        if (notification != null)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in notifications)
            n.IsRead = true;

        await _context.SaveChangesAsync();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);
    }
}
