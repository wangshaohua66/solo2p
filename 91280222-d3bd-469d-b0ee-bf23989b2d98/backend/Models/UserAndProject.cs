using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BlueprintReview.Models;

public enum UserRole
{
    [BsonRepresentation(BsonType.String)]
    ProjectManager,

    [BsonRepresentation(BsonType.String)]
    Designer,

    [BsonRepresentation(BsonType.String)]
    Reviewer
}

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("passwordHash")]
    public string PasswordHash { get; set; } = string.Empty;

    [BsonElement("avatar")]
    public string? Avatar { get; set; }

    [BsonElement("role")]
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; }

    [BsonElement("department")]
    public string? Department { get; set; }

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}

public class ProjectMember
{
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("role")]
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; }

    [BsonElement("joinedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class ProjectStats
{
    [BsonElement("totalDocuments")]
    public int TotalDocuments { get; set; }

    [BsonElement("totalAnnotations")]
    public int TotalAnnotations { get; set; }

    [BsonElement("resolvedAnnotations")]
    public int ResolvedAnnotations { get; set; }

    [BsonElement("pendingReviews")]
    public int PendingReviews { get; set; }

    [BsonElement("completedReviews")]
    public int CompletedReviews { get; set; }
}

public enum ProjectStatus
{
    [BsonRepresentation(BsonType.String)]
    Planning,

    [BsonRepresentation(BsonType.String)]
    InProgress,

    [BsonRepresentation(BsonType.String)]
    Reviewing,

    [BsonRepresentation(BsonType.String)]
    Completed,

    [BsonRepresentation(BsonType.String)]
    Archived
}

public class Project
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("buildingType")]
    public string? BuildingType { get; set; }

    [BsonElement("floorCount")]
    public int? FloorCount { get; set; }

    [BsonElement("area")]
    public double? Area { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public ProjectStatus Status { get; set; } = ProjectStatus.Planning;

    [BsonElement("members")]
    public List<ProjectMember> Members { get; set; } = new();

    [BsonElement("stats")]
    public ProjectStats Stats { get; set; } = new();

    [BsonElement("createdBy")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CreatedBy { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
