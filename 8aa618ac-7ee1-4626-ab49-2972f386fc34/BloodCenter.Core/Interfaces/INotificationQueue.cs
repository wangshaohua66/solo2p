namespace BloodCenter.Core.Interfaces;

public interface INotificationQueue
{
    Task EnqueueAsync(NotificationMessage message, CancellationToken cancellationToken = default);
    Task<NotificationMessage> DequeueAsync(CancellationToken cancellationToken = default);
    Task<(bool Success, NotificationMessage? Message)> TryDequeueAsync(TimeSpan timeout, CancellationToken cancellationToken = default);
}
