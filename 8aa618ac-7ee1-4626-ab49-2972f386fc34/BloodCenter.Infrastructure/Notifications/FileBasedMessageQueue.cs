using System.Collections.Concurrent;
using System.Text.Json;
using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BloodCenter.Infrastructure.Notifications;

public class FileBasedMessageQueueOptions
{
    public string QueueDirectory { get; set; } = "mq_data";
    public int MaxRetryCount { get; set; } = 5;
}

public class FileBasedMessageQueue : IExternalMessageQueue
{
    private readonly ILogger<FileBasedMessageQueue> _logger;
    private readonly FileBasedMessageQueueOptions _options;
    private readonly string _pendingDir;
    private readonly string _processedDir;
    private readonly ConcurrentDictionary<string, bool> _processingLock = new();

    public FileBasedMessageQueue(
        ILogger<FileBasedMessageQueue> logger,
        IOptions<FileBasedMessageQueueOptions> options)
    {
        _logger = logger;
        _options = options.Value;
        _pendingDir = Path.Combine(AppContext.BaseDirectory, _options.QueueDirectory, "pending");
        _processedDir = Path.Combine(AppContext.BaseDirectory, _options.QueueDirectory, "processed");

        if (!Directory.Exists(_pendingDir))
            Directory.CreateDirectory(_pendingDir);
        if (!Directory.Exists(_processedDir))
            Directory.CreateDirectory(_processedDir);

        _logger.LogInformation("FileBasedMessageQueue initialized. PendingDir={PendingDir}, ProcessedDir={ProcessedDir}",
            _pendingDir, _processedDir);
    }

    public async Task PublishAsync(NotificationMessage message, CancellationToken cancellationToken = default)
    {
        var messageId = Guid.NewGuid().ToString("N");
        var metadata = message.Metadata != null
            ? new Dictionary<string, string>(message.Metadata)
            : new Dictionary<string, string>();
        metadata["MessageId"] = messageId;
        metadata["PublishedAt"] = DateTime.UtcNow.ToString("o");

        var envelope = new
        {
            Id = messageId,
            Type = message.Type,
            Recipient = message.Recipient,
            Subject = message.Subject,
            Body = message.Body,
            Channel = message.Channel,
            Metadata = metadata,
            PublishedAt = DateTime.UtcNow
        };

        var filePath = Path.Combine(_pendingDir, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{messageId}.json");
        var json = JsonSerializer.Serialize(envelope, new JsonSerializerOptions { WriteIndented = true });

        await File.WriteAllTextAsync(filePath, json, cancellationToken);

        _logger.LogInformation(
            "Message published to external MQ: MessageId={MessageId}, Type={Type}, Channel={Channel}, File={File}",
            messageId, message.Type, message.Channel, Path.GetFileName(filePath));
    }

    public async Task<IEnumerable<NotificationMessage>> ConsumeBatchAsync(int batchSize, CancellationToken cancellationToken = default)
    {
        var messages = new List<NotificationMessage>();

        if (!Directory.Exists(_pendingDir))
            return messages;

        var files = Directory.GetFiles(_pendingDir, "*.json")
            .OrderBy(f => f)
            .Take(batchSize)
            .ToList();

        foreach (var file in files)
        {
            var lockKey = Path.GetFileName(file);
            if (!_processingLock.TryAdd(lockKey, true))
                continue;

            try
            {
                var json = await File.ReadAllTextAsync(file, cancellationToken);
                var envelope = JsonSerializer.Deserialize<JsonElement>(json);

                var id = envelope.GetProperty("Id").GetString() ?? Guid.NewGuid().ToString("N");
                var type = envelope.GetProperty("Type").GetString() ?? "Unknown";
                var recipient = envelope.GetProperty("Recipient").GetString() ?? string.Empty;
                var subject = envelope.GetProperty("Subject").GetString() ?? string.Empty;
                var body = envelope.GetProperty("Body").GetString() ?? string.Empty;
                var channel = envelope.GetProperty("Channel").GetString();

                IDictionary<string, string>? metadataDict = null;
                if (envelope.TryGetProperty("Metadata", out var metadataProp))
                {
                    metadataDict = new Dictionary<string, string>();
                    foreach (var prop in metadataProp.EnumerateObject())
                    {
                        metadataDict[prop.Name] = prop.Value.GetString() ?? string.Empty;
                    }
                }
                metadataDict ??= new Dictionary<string, string>();
                metadataDict["_QueueFilePath"] = file;

                messages.Add(new NotificationMessage(
                    Type: type,
                    Recipient: recipient,
                    Subject: subject,
                    Body: body,
                    Channel: channel,
                    Metadata: metadataDict));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to consume message from file: {File}", file);
                _processingLock.TryRemove(lockKey, out _);
            }
        }

        return messages;
    }

    public Task AcknowledgeAsync(string messageId, CancellationToken cancellationToken = default)
    {
        var filesToRemove = Directory.GetFiles(_pendingDir, $"*_{messageId}.json").ToList();

        foreach (var file in filesToRemove)
        {
            try
            {
                var fileName = Path.GetFileName(file);
                var processedPath = Path.Combine(_processedDir, fileName);

                if (File.Exists(processedPath))
                    File.Delete(processedPath);

                File.Move(file, processedPath);

                var lockKey = fileName;
                _processingLock.TryRemove(lockKey, out _);

                _logger.LogInformation(
                    "Message acknowledged and moved to processed: MessageId={MessageId}, File={File}",
                    messageId, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to acknowledge message: {MessageId}", messageId);
            }
        }

        return Task.CompletedTask;
    }
}
