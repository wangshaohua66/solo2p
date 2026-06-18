using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public enum ResponseLevel
{
    [BsonRepresentation(BsonType.String)]
    Level4,
    [BsonRepresentation(BsonType.String)]
    Level3,
    [BsonRepresentation(BsonType.String)]
    Level2,
    [BsonRepresentation(BsonType.String)]
    Level1
}

public class EmergencyPlan
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("reservoirId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ReservoirId { get; set; } = string.Empty;

    [BsonElement("reservoirName")]
    public string ReservoirName { get; set; } = string.Empty;

    [BsonElement("planName")]
    public string PlanName { get; set; } = string.Empty;

    [BsonElement("version")]
    public string Version { get; set; } = "1.0";

    [BsonElement("versionNumber")]
    public int VersionNumber { get; set; } = 1;

    [BsonElement("isCurrent")]
    public bool IsCurrent { get; set; } = true;

    [BsonElement("status")]
    public string Status { get; set; } = "approved";

    [BsonElement("approvedBy")]
    public string? ApprovedBy { get; set; }

    [BsonElement("approvedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? ApprovedAt { get; set; }

    [BsonElement("levels")]
    public List<ResponseLevelConfig> Levels { get; set; } = new();

    [BsonElement("generalMeasures")]
    public List<string> GeneralMeasures { get; set; } = new();

    [BsonElement("emergencyContacts")]
    public List<EmergencyContact> EmergencyContacts { get; set; } = new();

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ResponseLevelConfig
{
    [BsonElement("level")]
    [BsonRepresentation(BsonType.String)]
    public ResponseLevel Level { get; set; }

    [BsonElement("levelName")]
    public string LevelName { get; set; } = string.Empty;

    [BsonElement("triggerWaterLevel")]
    public double TriggerWaterLevel { get; set; }

    [BsonElement("triggerFlow")]
    public double? TriggerFlow { get; set; }

    [BsonElement("triggerRainfall")]
    public double? TriggerRainfall { get; set; }

    [BsonElement("color")]
    public string Color { get; set; } = "blue";

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("measures")]
    public List<ResponseMeasure> Measures { get; set; } = new();

    [BsonElement("responsibleRoles")]
    public List<string> ResponsibleRoles { get; set; } = new();
}

public class ResponseMeasure
{
    [BsonElement("measureId")]
    public string MeasureId { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("department")]
    public string? Department { get; set; }

    [BsonElement("order")]
    public int Order { get; set; }
}

public class EmergencyContact
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("role")]
    public string Role { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("department")]
    public string? Department { get; set; }
}

public class PlanDiffResult
{
    public string Field { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string ChangeType { get; set; } = "modified";
}
