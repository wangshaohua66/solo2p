using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BlueprintReview.Models;

public enum AnnotationType
{
    [BsonRepresentation(BsonType.String)]
    Rectangle,

    [BsonRepresentation(BsonType.String)]
    Circle,

    [BsonRepresentation(BsonType.String)]
    Arrow,

    [BsonRepresentation(BsonType.String)]
    Freeform
}

public enum AnnotationStatus
{
    [BsonRepresentation(BsonType.String)]
    Open,

    [BsonRepresentation(BsonType.String)]
    InProgress,

    [BsonRepresentation(BsonType.String)]
    Resolved,

    [BsonRepresentation(BsonType.String)]
    Rejected
}

public enum AnnotationSeverity
{
    [BsonRepresentation(BsonType.String)]
    Low,

    [BsonRepresentation(BsonType.String)]
    Medium,

    [BsonRepresentation(BsonType.String)]
    High,

    [BsonRepresentation(BsonType.String)]
    Critical
}

public class AnnotationPoint
{
    [BsonElement("x")]
    public double X { get; set; }

    [BsonElement("y")]
    public double Y { get; set; }
}

public class AnnotationGeometry
{
    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public AnnotationType Type { get; set; }

    [BsonElement("points")]
    public List<AnnotationPoint> Points { get; set; } = new();

    [BsonElement("width")]
    public double? Width { get; set; }

    [BsonElement("height")]
    public double? Height { get; set; }

    [BsonElement("radius")]
    public double? Radius { get; set; }

    [BsonElement("color")]
    public string Color { get; set; } = "#ef4444";

    [BsonElement("strokeWidth")]
    public int StrokeWidth { get; set; } = 2;
}

public class AnnotationReply
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("authorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string AuthorId { get; set; } = string.Empty;

    [BsonElement("authorName")]
    public string AuthorName { get; set; } = string.Empty;

    [BsonElement("authorAvatar")]
    public string? AuthorAvatar { get; set; }

    [BsonElement("mentions")]
    public List<string> Mentions { get; set; } = new();

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AnnotationConflict
{
    [BsonElement("annotationId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string AnnotationId { get; set; } = string.Empty;

    [BsonElement("overlapArea")]
    public double OverlapArea { get; set; }

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("timestamp")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class Annotation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("documentId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string DocumentId { get; set; } = string.Empty;

    [BsonElement("versionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string VersionId { get; set; } = string.Empty;

    [BsonElement("pageNumber")]
    public int PageNumber { get; set; }

    [BsonElement("geometry")]
    public AnnotationGeometry Geometry { get; set; } = new();

    [BsonElement("content")]
    public string Content { get; set; } = string.Empty;

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public AnnotationStatus Status { get; set; } = AnnotationStatus.Open;

    [BsonElement("severity")]
    [BsonRepresentation(BsonType.String)]
    public AnnotationSeverity Severity { get; set; } = AnnotationSeverity.Medium;

    [BsonElement("authorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string AuthorId { get; set; } = string.Empty;

    [BsonElement("authorName")]
    public string AuthorName { get; set; } = string.Empty;

    [BsonElement("authorAvatar")]
    public string? AuthorAvatar { get; set; }

    [BsonElement("assigneeId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? AssigneeId { get; set; }

    [BsonElement("assigneeName")]
    public string? AssigneeName { get; set; }

    [BsonElement("replies")]
    public List<AnnotationReply> Replies { get; set; } = new();

    [BsonElement("mentions")]
    public List<string> Mentions { get; set; } = new();

    [BsonElement("migratedFrom")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? MigratedFrom { get; set; }

    [BsonElement("isMigrated")]
    public bool IsMigrated { get; set; }

    [BsonElement("conflicts")]
    public List<AnnotationConflict> Conflicts { get; set; } = new();

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
