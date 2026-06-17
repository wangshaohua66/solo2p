using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Infrastructure.Workers;

public class NotificationQueueHostedService : BackgroundService
{
    private readonly ILogger<NotificationQueueHostedService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly INotificationQueue _queue;
    private const int MaxRetryCount = 5;
    private const int RetryDelaySeconds = 30;

    public NotificationQueueHostedService(
        ILogger<NotificationQueueHostedService> logger,
        IServiceScopeFactory scopeFactory,
        INotificationQueue queue)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _queue = queue;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("NotificationQueueHostedService is starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var message = await _queue.DequeueAsync(stoppingToken);

                if (message != null)
                {
                    _logger.LogInformation(
                        "Processing notification message: Type={Type}, Channel={Channel}, Recipient={Recipient}",
                        message.Type, message.Channel, message.Recipient);

                    await ProcessMessageAsync(message, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while processing notification queue");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        _logger.LogInformation("NotificationQueueHostedService is stopping");
    }

    private async Task ProcessMessageAsync(NotificationMessage message, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();

        var retryCount = GetRetryCount(message);

        try
        {
            var channel = message.Channel;
            bool delivered = false;

            if (channel == NotificationChannel.Email.ToString())
            {
                var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
                await emailSender.SendEmailAsync(message.Recipient, message.Subject, message.Body, stoppingToken);
                delivered = true;
            }
            else if (channel == NotificationChannel.Sms.ToString())
            {
                var smsSender = scope.ServiceProvider.GetRequiredService<ISmsSender>();
                await smsSender.SendSmsAsync(message.Recipient, message.Body, stoppingToken);
                delivered = true;
            }
            else if (channel == NotificationChannel.InApp.ToString())
            {
                _logger.LogInformation(
                    "In-app notification delivered (Type={Type}, Recipient={Recipient}): {Subject}",
                    message.Type, message.Recipient, message.Subject);
                delivered = true;
            }
            else if (channel == NotificationChannel.MessageQueue.ToString())
            {
                _logger.LogInformation(
                    "Message queue notification processed (Type={Type}, Recipient={Recipient}): {Subject}",
                    message.Type, message.Recipient, message.Subject);
                delivered = true;
            }
            else
            {
                _logger.LogWarning(
                    "Unknown notification channel: {Channel}. Message Type={Type}, Recipient={Recipient}",
                    channel, message.Type, message.Recipient);
                delivered = true;
            }

            if (delivered)
            {
                _logger.LogInformation(
                    "Notification delivered successfully: Type={Type}, Channel={Channel}, Recipient={Recipient}, RetryCount={RetryCount}",
                    message.Type, message.Channel, message.Recipient, retryCount);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to deliver notification: Type={Type}, Channel={Channel}, Recipient={Recipient}, RetryCount={RetryCount}",
                message.Type, message.Channel, message.Recipient, retryCount);

            if (retryCount < MaxRetryCount)
            {
                var retryMessage = CreateRetryMessage(message, retryCount + 1);
                _logger.LogInformation(
                    "Re-enqueueing notification for retry {RetryCount}/{MaxRetryCount} after {Delay}s delay",
                    retryCount + 1, MaxRetryCount, RetryDelaySeconds);

                await Task.Delay(TimeSpan.FromSeconds(RetryDelaySeconds), stoppingToken);
                await _queue.EnqueueAsync(retryMessage, stoppingToken);
            }
            else
            {
                _logger.LogError(
                    "Notification failed after {MaxRetryCount} retries. Type={Type}, Channel={Channel}, Recipient={Recipient}",
                    MaxRetryCount, message.Type, message.Channel, message.Recipient);
            }
        }
    }

    private static int GetRetryCount(NotificationMessage message)
    {
        if (message.Metadata != null &&
            message.Metadata.TryGetValue("RetryCount", out var retryCountStr) &&
            int.TryParse(retryCountStr, out var retryCount))
        {
            return retryCount;
        }

        return 0;
    }

    private static NotificationMessage CreateRetryMessage(NotificationMessage original, int retryCount)
    {
        var metadata = original.Metadata != null
            ? new Dictionary<string, string>(original.Metadata)
            : new Dictionary<string, string>();

        metadata["RetryCount"] = retryCount.ToString();
        metadata["LastRetryTime"] = DateTime.UtcNow.ToString("o");

        return original with { Metadata = metadata };
    }
}
