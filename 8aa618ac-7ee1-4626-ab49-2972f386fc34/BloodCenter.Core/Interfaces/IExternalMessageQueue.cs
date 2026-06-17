namespace BloodCenter.Core.Interfaces;

public interface IExternalMessageQueue
{
    Task PublishAsync(NotificationMessage message, CancellationToken cancellationToken = default);
    Task<IEnumerable<NotificationMessage>> ConsumeBatchAsync(int batchSize, CancellationToken cancellationToken = default);
    Task AcknowledgeAsync(string messageId, CancellationToken cancellationToken = default);
}
