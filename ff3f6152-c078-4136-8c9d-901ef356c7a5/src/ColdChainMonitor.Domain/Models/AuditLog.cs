using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class AuditLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("traceId")]
    public string TraceId { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("actionType")]
    public AuditActionType ActionType { get; set; }

    [BsonElement("actionName")]
    public string ActionName { get; set; } = string.Empty;

    [BsonElement("module")]
    public string Module { get; set; } = string.Empty;

    [BsonElement("entityType")]
    public string? EntityType { get; set; }

    [BsonElement("entityId")]
    public string? EntityId { get; set; }

    [BsonElement("operatorId")]
    public string? OperatorId { get; set; }

    [BsonElement("operatorName")]
    public string? OperatorName { get; set; }

    [BsonElement("operatorRole")]
    public UserRole? OperatorRole { get; set; }

    [BsonElement("ipAddress")]
    public string? IpAddress { get; set; }

    [BsonElement("userAgent")]
    public string? UserAgent { get; set; }

    [BsonElement("oldValue")]
    public string? OldValue { get; set; }

    [BsonElement("newValue")]
    public string? NewValue { get; set; }

    [BsonElement("requestUrl")]
    public string? RequestUrl { get; set; }

    [BsonElement("requestMethod")]
    public string? RequestMethod { get; set; }

    [BsonElement("status")]
    public bool Status { get; set; } = true;

    [BsonElement("errorMessage")]
    public string? ErrorMessage { get; set; }

    [BsonElement("durationMs")]
    public long DurationMs { get; set; }

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
