using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public class Levee
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("riverName")]
    public string RiverName { get; set; } = string.Empty;

    [BsonElement("startPoint")]
    public string StartPoint { get; set; } = string.Empty;

    [BsonElement("endPoint")]
    public string EndPoint { get; set; } = string.Empty;

    [BsonElement("lengthKm")]
    public double LengthKm { get; set; }

    [BsonElement("designLevel")]
    public string DesignLevel { get; set; } = string.Empty;

    [BsonElement("designWaterLevel")]
    public double DesignWaterLevel { get; set; }

    [BsonElement("guaranteeWaterLevel")]
    public double GuaranteeWaterLevel { get; set; }

    [BsonElement("warningWaterLevel")]
    public double WarningWaterLevel { get; set; }

    [BsonElement("material")]
    public string Material { get; set; } = string.Empty;

    [BsonElement("status")]
    public string Status { get; set; } = string.Empty;

    [BsonElement("responsibleUnit")]
    public string ResponsibleUnit { get; set; } = string.Empty;

    [BsonElement("responsiblePerson")]
    public string ResponsiblePerson { get; set; } = string.Empty;

    [BsonElement("contactPhone")]
    public string ContactPhone { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
