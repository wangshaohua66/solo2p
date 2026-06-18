using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public class Gate
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("type")]
    public string Type { get; set; } = "spillway";

    [BsonElement("reservoirId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ReservoirId { get; set; } = string.Empty;

    [BsonElement("reservoirName")]
    public string ReservoirName { get; set; } = string.Empty;

    [BsonElement("maxOpening")]
    public double MaxOpening { get; set; }

    [BsonElement("currentOpening")]
    public double CurrentOpening { get; set; }

    [BsonElement("width")]
    public double Width { get; set; }

    [BsonElement("elevation")]
    public double Elevation { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "operational";

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
