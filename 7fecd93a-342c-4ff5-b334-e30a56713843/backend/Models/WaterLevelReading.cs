using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public class WaterLevelReading
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("stationId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string StationId { get; set; } = string.Empty;

    [BsonElement("stationCode")]
    public string StationCode { get; set; } = string.Empty;

    [BsonElement("stationName")]
    public string StationName { get; set; } = string.Empty;

    [BsonElement("stationType")]
    public string StationType { get; set; } = "reservoir";

    [BsonElement("timestamp")]
    [BsonRepresentation(BsonType.DateTime)]
    [BsonIndex]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("waterLevel")]
    public double? WaterLevel { get; set; }

    [BsonElement("inflow")]
    public double? Inflow { get; set; }

    [BsonElement("outflow")]
    public double? Outflow { get; set; }

    [BsonElement("rainfall")]
    public double? Rainfall { get; set; }

    [BsonElement("cumulativeRainfall")]
    public double? CumulativeRainfall { get; set; }

    [BsonElement("storage")]
    public double? Storage { get; set; }

    [BsonElement("isWarning")]
    public bool IsWarning { get; set; }

    [BsonElement("isDanger")]
    public bool IsDanger { get; set; }

    [BsonElement("source")]
    public string Source { get; set; } = "telemetry";
}

[AttributeUsage(AttributeTargets.Property)]
public class BsonIndexAttribute : Attribute
{
}
