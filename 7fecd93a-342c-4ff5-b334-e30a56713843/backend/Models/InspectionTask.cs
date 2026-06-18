using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace WaterManagement.API.Models;

public enum InspectionStatus
{
    [BsonRepresentation(BsonType.String)]
    Pending,
    [BsonRepresentation(BsonType.String)]
    InProgress,
    [BsonRepresentation(BsonType.String)]
    Completed,
    [BsonRepresentation(BsonType.String)]
    HasDefect,
    [BsonRepresentation(BsonType.String)]
    Closed
}

public enum DefectSeverity
{
    [BsonRepresentation(BsonType.String)]
    Minor,
    [BsonRepresentation(BsonType.String)]
    Major,
    [BsonRepresentation(BsonType.String)]
    Critical
}

public enum DefectStatus
{
    [BsonRepresentation(BsonType.String)]
    Reported,
    [BsonRepresentation(BsonType.String)]
    Confirmed,
    [BsonRepresentation(BsonType.String)]
    InProgress,
    [BsonRepresentation(BsonType.String)]
    Resolved,
    [BsonRepresentation(BsonType.String)]
    Closed
}

public class InspectionTask
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("taskCode")]
    public string TaskCode { get; set; } = string.Empty;

    [BsonElement("planId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? PlanId { get; set; }

    [BsonElement("planMonth")]
    public string PlanMonth { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("facilityType")]
    public string FacilityType { get; set; } = string.Empty;

    [BsonElement("facilityName")]
    public string FacilityName { get; set; } = string.Empty;

    [BsonElement("inspectorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string InspectorId { get; set; } = string.Empty;

    [BsonElement("inspectorName")]
    public string InspectorName { get; set; } = string.Empty;

    [BsonElement("route")]
    public List<string> Route { get; set; } = new();

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public InspectionStatus Status { get; set; } = InspectionStatus.Pending;

    [BsonElement("scheduledDate")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime ScheduledDate { get; set; }

    [BsonElement("startTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? StartTime { get; set; }

    [BsonElement("endTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? EndTime { get; set; }

    [BsonElement("defects")]
    public List<Defect> Defects { get; set; } = new();

    [BsonElement("remark")]
    public string? Remark { get; set; }

    [BsonElement("createdAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Defect
{
    [BsonElement("defectId")]
    public string DefectId { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("partName")]
    public string PartName { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("severity")]
    [BsonRepresentation(BsonType.String)]
    public DefectSeverity Severity { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public DefectStatus Status { get; set; } = DefectStatus.Reported;

    [BsonElement("location")]
    public string? Location { get; set; }

    [BsonElement("latitude")]
    public double? Latitude { get; set; }

    [BsonElement("longitude")]
    public double? Longitude { get; set; }

    [BsonElement("photos")]
    public List<string> Photos { get; set; } = new();

    [BsonElement("reporterId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? ReporterId { get; set; }

    [BsonElement("reporterName")]
    public string? ReporterName { get; set; }

    [BsonElement("reportTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime ReportTime { get; set; } = DateTime.UtcNow;

    [BsonElement("resolveTime")]
    [BsonRepresentation(BsonType.DateTime)]
    public DateTime? ResolveTime { get; set; }

    [BsonElement("resolveRemark")]
    public string? ResolveRemark { get; set; }
}
