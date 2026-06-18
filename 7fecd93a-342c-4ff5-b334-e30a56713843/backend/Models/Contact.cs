using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public enum ContactRole
{
    [BsonRepresentation(BsonType.String)]
    Dispatcher,
    [BsonRepresentation(BsonType.String)]
    Inspector,
    [BsonRepresentation(BsonType.String)]
    Admin,
    [BsonRepresentation(BsonType.String)]
    Maintenance,
    [BsonRepresentation(BsonType.String)]
    Leader
}

public class Contact
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("role")]
    [BsonRepresentation(BsonType.String)]
    public ContactRole Role { get; set; }

    [BsonElement("roleName")]
    public string RoleName { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("department")]
    public string? Department { get; set; }

    [BsonElement("position")]
    public string? Position { get; set; }

    [BsonElement("isOnDuty")]
    public bool IsOnDuty { get; set; } = true;

    [BsonElement("sortOrder")]
    public int SortOrder { get; set; }

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
