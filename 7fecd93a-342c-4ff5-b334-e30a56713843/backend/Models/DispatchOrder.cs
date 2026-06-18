using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public enum DispatchStatus
{
    [BsonRepresentation(BsonType.String)]
    Pending,
    [BsonRepresentation(BsonType.String)]
    Sent,
    [BsonRepresentation(BsonType.String)]
    Delivered,
    [BsonRepresentation(BsonType.String)]
    Confirmed,
    [BsonRepresentation(BsonType.String)]
    Closed,
    [BsonRepresentation(BsonType.String)]
    Overdue,
    [BsonRepresentation(BsonType.String)]
    Cancelled
}

public class DispatchOrder
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("orderCode")]
    public string OrderCode { get; set; } = string.Empty;

    [BsonElement("gateId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string GateId { get; set; } = string.Empty;

    [BsonElement("gateName")]
    public string GateName { get; set; } = string.Empty;

    [BsonElement("reservoirId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ReservoirId { get; set; } = string.Empty;

    [BsonElement("reservoirName")]
    public string ReservoirName { get; set; } = string.Empty;

    [BsonElement("targetOpening")]
    public double TargetOpening { get; set; }

    [BsonElement("actualOpening")]
    public double? ActualOpening { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public DispatchStatus Status { get; set; } = DispatchStatus.Pending;

    [BsonElement("priority")]
    public string Priority { get; set; } = "normal";

    [BsonElement("reason")]
    public string? Reason { get; set; }

    [BsonElement("instructions")]
    public string? Instructions { get; set; }

    [BsonElement("senderId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? SenderId { get; set; }

    [BsonElement("senderName")]
    public string SenderName { get; set; } = string.Empty;

    [BsonElement("receiverId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ReceiverId { get; set; } = string.Empty;

    [BsonElement("receiverName")]
    public string ReceiverName { get; set; } = string.Empty;

    [BsonElement("confirmDeadline")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime ConfirmDeadline { get; set; }

    [BsonElement("sendTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? SendTime { get; set; }

    [BsonElement("deliverTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? DeliverTime { get; set; }

    [BsonElement("confirmTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? ConfirmTime { get; set; }

    [BsonElement("closeTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? CloseTime { get; set; }

    [BsonElement("confirmRemark")]
    public string? ConfirmRemark { get; set; }

    [BsonElement("traceLogs")]
    public List<DispatchTraceLog> TraceLogs { get; set; } = new();

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DispatchTraceLog
{
    [BsonElement("timestamp")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public DispatchStatus Status { get; set; }

    [BsonElement("operatorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? OperatorId { get; set; }

    [BsonElement("operatorName")]
    public string? OperatorName { get; set; }

    [BsonElement("remark")]
    public string? Remark { get; set; }
}
