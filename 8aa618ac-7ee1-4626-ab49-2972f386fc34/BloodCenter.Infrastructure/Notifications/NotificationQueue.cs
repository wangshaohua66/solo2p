using System.Threading.Channels;
using BloodCenter.Core.Interfaces;

namespace BloodCenter.Infrastructure.Notifications;

public class NotificationQueue : INotificationQueue
{
    private readonly Channel<NotificationMessage> _queue;

    public NotificationQueue()
    {
        var options = new BoundedChannelOptions(int.MaxValue)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = false,
            SingleWriter = false
        };

        _queue = Channel.CreateBounded<NotificationMessage>(options);
    }

    public async Task EnqueueAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (message == null)
        {
            throw new ArgumentNullException(nameof(message));
        }

        await _queue.Writer.WriteAsync(message, cancellationToken);
    }

    public Task<NotificationMessage> DequeueAsync(CancellationToken cancellationToken = default)
    {
        return _queue.Reader.ReadAsync(cancellationToken).AsTask();
    }

    public async Task<bool> TryDequeueAsync(
        TimeSpan timeout,
        out NotificationMessage? message,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(timeout);

            message = await _queue.Reader.ReadAsync(cts.Token);
            return true;
        }
        catch (OperationCanceledException)
        {
            message = null;
            return false;
        }
        catch (ChannelClosedException)
        {
            message = null;
            return false;
        }
    }
}
