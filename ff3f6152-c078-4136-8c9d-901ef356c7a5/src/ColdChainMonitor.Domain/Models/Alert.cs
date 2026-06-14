using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class Alert
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("alertNo")]
    public string AlertNo { get; set; } = string.Empty;

    [BsonElement("alertType")]
    public AlertType AlertType { get; set; }

    [BsonElement("alertLevel")]
    public AlertLevel AlertLevel { get; set; }

    [BsonElement("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [BsonElement("deviceName")]
    public string? DeviceName { get; set; }

    [BsonElement("transportTaskId")]
    public string? TransportTaskId { get; set; }

    [BsonElement("taskNo")]
    public string? TaskNo { get; set; }

    [BsonElement("value")]
    public double? Value { get; set; }

    [BsonElement("threshold")]
    public double? Threshold { get; set; }

    [BsonElement("durationSeconds")]
    public int? DurationSeconds { get; set; }

    [BsonElement("location")]
    public GpsLocation? Location { get; set; }

    [BsonElement("message")]
    public string Message { get; set; } = string.Empty;

    [BsonElement("isAcknowledged")]
    public bool IsAcknowledged { get; set; } = false;

    [BsonElement("acknowledgedBy")]
    public string? AcknowledgedBy { get; set; }

    [BsonElement("acknowledgedByName")]
    public string? AcknowledgedByName { get; set; }

    [BsonElement("acknowledgedAt")]
    public DateTime? AcknowledgedAt { get; set; }

    [BsonElement("acknowledgeRemark")]
    public string? AcknowledgeRemark { get; set; }

    [BsonElement("isResolved")]
    public bool IsResolved { get; set; } = false;

    [BsonElement("resolvedBy")]
    public string? ResolvedBy { get; set; }

    [BsonElement("resolvedByName")]
    public string? ResolvedByName { get; set; }

    [BsonElement("resolvedAt")]
    public DateTime? ResolvedAt { get; set; }

    [BsonElement("resolveRemark")]
    public string? ResolveRemark { get; set; }

    [BsonElement("notifiedUserIds")]
    public List<string> NotifiedUserIds { get; set; } = new();

    [BsonElement("firstTriggeredAt")]
    public DateTime FirstTriggeredAt { get; set; } = DateTime.UtcNow;

    [BsonElement("lastTriggeredAt")]
    public DateTime LastTriggeredAt { get; set; } = DateTime.UtcNow;

    [BsonElement("triggerCount")]
    public int TriggerCount { get; set; } = 1;

    [BsonElement("ruleId")]
    public string? RuleId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
