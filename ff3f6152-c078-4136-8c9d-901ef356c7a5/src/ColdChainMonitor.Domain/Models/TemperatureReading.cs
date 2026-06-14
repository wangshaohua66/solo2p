using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ColdChainMonitor.Domain.Models;

public class TemperatureReading
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("temperature")]
    public double Temperature { get; set; }

    [BsonElement("humidity")]
    public double? Humidity { get; set; }

    [BsonElement("location")]
    public GpsLocation? Location { get; set; }

    [BsonElement("batteryLevel")]
    public double? BatteryLevel { get; set; }

    [BsonElement("signalStrength")]
    public int? SignalStrength { get; set; }

    [BsonElement("transportTaskId")]
    public string? TransportTaskId { get; set; }

    [BsonElement("isAnomaly")]
    public bool IsAnomaly { get; set; } = false;

    [BsonElement("receivedAt")]
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
}
