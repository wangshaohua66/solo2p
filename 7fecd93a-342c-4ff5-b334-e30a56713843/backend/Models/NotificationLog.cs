using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public enum NotificationStatus
{
    [BsonRepresentation(BsonType.String)]
    Pending,
    [BsonRepresentation(BsonType.String)]
    Sent,
    [BsonRepresentation(BsonType.String)]
    Delivered,
    [BsonRepresentation(BsonType.String)]
    Read,
    [BsonRepresentation(BsonType.String)]
    Failed
}

public enum NotificationChannel
{
    [BsonRepresentation(BsonType.String)]
    SMS,
    [BsonRepresentation(BsonType.String)]
    Phone,
    [BsonRepresentation(BsonType.String)]
    AppPush,
    [BsonRepresentation(BsonType.String)]
    WeChat,
    [BsonRepresentation(BsonType.String)]
    Email
}

public class NotificationLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("batchId")]
    public string BatchId { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("channel")]
    [BsonRepresentation(BsonType.String)]
    public NotificationChannel Channel { get; set; }

    [BsonElement("senderId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? SenderId { get; set; }

    [BsonElement("senderName")]
    public string SenderName { get; set; } = string.Empty;

    [BsonElement("recipientId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string RecipientId { get; set; } = string.Empty;

    [BsonElement("recipientName")]
    public string RecipientName { get; set; } = string.Empty;

    [BsonElement("recipientPhone")]
    public string RecipientPhone { get; set; } = string.Empty;

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;

    [BsonElement("statusHistory")]
    public List<NotificationStatusEntry> StatusHistory { get; set; } = new();

    [BsonElement("relatedType")]
    public string? RelatedType { get; set; }

    [BsonElement("relatedId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? RelatedId { get; set; }

    [BsonElement("priority")]
    public string Priority { get; set; } = "normal";

    [BsonElement("retryCount")]
    public int RetryCount { get; set; }

    [BsonElement("errorMessage")]
    public string? ErrorMessage { get; set; }

    [BsonElement("sentAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? SentAt { get; set; }

    [BsonElement("deliveredAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? DeliveredAt { get; set; }

    [BsonElement("readAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? ReadAt { get; set; }

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class NotificationStatusEntry
{
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public NotificationStatus Status { get; set; }

    [BsonElement("timestamp")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("remark")]
    public string? Remark { get; set; }
}

public class NotifyResult
{
    public string BatchId { get; set; } = string.Empty;
    public int TotalCount { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public List<string>? FailedRecipients { get; set; }
}
