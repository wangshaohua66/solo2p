using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Infrastructure.Workers;

public class ExternalMessageQueueConsumerHostedService : BackgroundService
{
    private readonly ILogger<ExternalMessageQueueConsumerHostedService> _logger;
    private readonly IExternalMessageQueue _externalQueue;
    private readonly INotificationQueue _internalQueue;
    private const int PollIntervalSeconds = 5;
    private const int BatchSize = 10;

    public ExternalMessageQueueConsumerHostedService(
        ILogger<ExternalMessageQueueConsumerHostedService> logger,
        IExternalMessageQueue externalQueue,
        INotificationQueue internalQueue)
    {
        _logger = logger;
        _externalQueue = externalQueue;
        _internalQueue = internalQueue;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExternalMessageQueueConsumerHostedService is starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var messages = await _externalQueue.ConsumeBatchAsync(BatchSize, stoppingToken);
                var messageList = messages.ToList();

                if (messageList.Count > 0)
                {
                    _logger.LogInformation("External MQ consumer fetched {Count} messages", messageList.Count);

                    foreach (var message in messageList)
                    {
                        _logger.LogInformation(
                            "Processing external MQ message: Type={Type}, Recipient={Recipient}, Channel={Channel}",
                            message.Type, message.Recipient, message.Channel);

                        await ProcessExternalMessageAsync(message, stoppingToken);

                        var messageId = message.Metadata != null && message.Metadata.ContainsKey("MessageId")
                            ? message.Metadata["MessageId"]
                            : Guid.NewGuid().ToString("N");

                        await _externalQueue.AcknowledgeAsync(messageId, stoppingToken);
                    }
                }

                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while consuming external message queue");
                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds * 2), stoppingToken);
            }
        }

        _logger.LogInformation("ExternalMessageQueueConsumerHostedService is stopping");
    }

    private async Task ProcessExternalMessageAsync(NotificationMessage message, CancellationToken stoppingToken)
    {
        try
        {
            var forwardedMessage = new NotificationMessage(
                Type: message.Type,
                Recipient: message.Recipient,
                Subject: message.Subject,
                Body: message.Body,
                Channel: message.Channel == NotificationChannel.MessageQueue.ToString()
                    ? NotificationChannel.InApp.ToString()
                    : message.Channel,
                Metadata: message.Metadata != null
                    ? new Dictionary<string, string>(message.Metadata)
                    : null);

            await _internalQueue.EnqueueAsync(forwardedMessage, stoppingToken);

            _logger.LogInformation(
                "External MQ message forwarded to internal queue: Type={Type}, Recipient={Recipient}",
                message.Type, message.Recipient);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to process external MQ message: Type={Type}, Recipient={Recipient}",
                message.Type, message.Recipient);
            throw;
        }
    }
}
