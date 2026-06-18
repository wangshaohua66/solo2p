using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public class Reservoir
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; set; } = "reservoir";

    [BsonElement("longitude")]
    public double Longitude { get; set; }

    [BsonElement("latitude")]
    public double Latitude { get; set; }

    [BsonElement("capacity")]
    public double Capacity { get; set; }

    [BsonElement("normalPoolLevel")]
    public double NormalPoolLevel { get; set; }

    [BsonElement("floodLimitLevel")]
    public double FloodLimitLevel { get; set; }

    [BsonElement("warningLevel")]
    public double WarningLevel { get; set; }

    [BsonElement("dangerLevel")]
    public double DangerLevel { get; set; }

    [BsonElement("deadLevel")]
    public double DeadLevel { get; set; }

    [BsonElement("watershedArea")]
    public double WatershedArea { get; set; }

    [BsonElement("gateCount")]
    public int GateCount { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "normal";

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class RainfallStation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; set; } = "rainfall";

    [BsonElement("longitude")]
    public double Longitude { get; set; }

    [BsonElement("latitude")]
    public double Latitude { get; set; }

    [BsonElement("reservoirId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? ReservoirId { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "normal";

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
