using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FireTraining.Data;
using FireTraining.Models;

namespace FireTraining.Services;

public interface INotificationService
{
    Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
    Task SendInAppMessageAsync(int userId, string title, string content, string? type = null, CancellationToken cancellationToken = default);
    Task SendOverdueReminderAsync(int reservationId, CancellationToken cancellationToken = default);
}

public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(AppDbContext context, ILogger<NotificationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation($"发送邮件到 {to}: {subject}");
        await Task.CompletedTask;
    }

    public async Task SendInAppMessageAsync(int userId, string title, string content, string? type = null, CancellationToken cancellationToken = default)
    {
        var message = new InAppMessage
        {
            UserId = userId,
            Title = title,
            Content = content,
            Type = type ?? "System",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.InAppMessages.Add(message);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task SendOverdueReminderAsync(int reservationId, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations
            .Include(r => r.Equipment)
            .Include(r => r.Firefighter)
            .FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken);

        if (reservation == null || reservation.Firefighter == null)
            return;

        var title = "器材逾期提醒";
        var content = $"您预约的「{reservation.Equipment?.Name ?? "器材"}」已超过预计归还时间，请尽快归还。" +
                      $"预约时段：{reservation.StartTime:yyyy-MM-dd HH:mm} - {reservation.EndTime:yyyy-MM-dd HH:mm}";

        await SendInAppMessageAsync(reservation.FirefighterId, title, content, "Overdue", cancellationToken);

        if (!string.IsNullOrEmpty(reservation.Firefighter.Email))
        {
            await SendEmailAsync(reservation.Firefighter.Email, title, content, cancellationToken);
        }

        _logger.LogInformation($"已发送逾期提醒：预约ID={reservationId}, 消防员={reservation.Firefighter.Name}");
    }
}
