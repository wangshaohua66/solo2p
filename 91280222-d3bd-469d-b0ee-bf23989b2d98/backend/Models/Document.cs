using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BlueprintReview.Models;

public class DocumentPage
{
    [BsonElement("pageNumber")]
    public int PageNumber { get; set; }

    [BsonElement("width")]
    public int Width { get; set; }

    [BsonElement("height")]
    public int Height { get; set; }

    [BsonElement("thumbnailUrl")]
    public string? ThumbnailUrl { get; set; }

    [BsonElement("imageUrl")]
    public string ImageUrl { get; set; } = string.Empty;
}

public class VersionDiffRegion
{
    [BsonElement("pageNumber")]
    public int PageNumber { get; set; }

    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public string Type { get; set; } = "modified";

    [BsonElement("bounds")]
    public Bounds Bounds { get; set; } = new();

    [BsonElement("confidence")]
    public double Confidence { get; set; }
}

public class Bounds
{
    [BsonElement("x")]
    public double X { get; set; }

    [BsonElement("y")]
    public double Y { get; set; }

    [BsonElement("width")]
    public double Width { get; set; }

    [BsonElement("height")]
    public double Height { get; set; }
}

public class VersionDiffSummary
{
    [BsonElement("totalChanges")]
    public int TotalChanges { get; set; }

    [BsonElement("addedRegions")]
    public int AddedRegions { get; set; }

    [BsonElement("removedRegions")]
    public int RemovedRegions { get; set; }

    [BsonElement("modifiedRegions")]
    public int ModifiedRegions { get; set; }

    [BsonElement("regions")]
    public List<VersionDiffRegion> Regions { get; set; } = new();
}

public class DocumentVersion
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("version")]
    public string Version { get; set; } = "1.0";

    [BsonElement("major")]
    public int Major { get; set; } = 1;

    [BsonElement("minor")]
    public int Minor { get; set; } = 0;

    [BsonElement("uploaderId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UploaderId { get; set; } = string.Empty;

    [BsonElement("uploaderName")]
    public string UploaderName { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("fileUrl")]
    public string FileUrl { get; set; } = string.Empty;

    [BsonElement("fileId")]
    public string? FileId { get; set; }

    [BsonElement("pages")]
    public List<DocumentPage> Pages { get; set; } = new();

    [BsonElement("pageCount")]
    public int PageCount { get; set; }

    [BsonElement("previousVersionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? PreviousVersionId { get; set; }

    [BsonElement("diffSummary")]
    public VersionDiffSummary? DiffSummary { get; set; }

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum DocumentStatus
{
    [BsonRepresentation(BsonType.String)]
    Draft,

    [BsonRepresentation(BsonType.String)]
    Submitted,

    [BsonRepresentation(BsonType.String)]
    UnderReview,

    [BsonRepresentation(BsonType.String)]
    NeedsRevision,

    [BsonRepresentation(BsonType.String)]
    Approved,

    [BsonRepresentation(BsonType.String)]
    Rejected
}

public class PermissionMatrix
{
    [BsonElement("canView")]
    public bool CanView { get; set; } = true;

    [BsonElement("canAnnotate")]
    public bool CanAnnotate { get; set; } = false;

    [BsonElement("canDownload")]
    public bool CanDownload { get; set; } = true;

    [BsonElement("canDelete")]
    public bool CanDelete { get; set; } = false;

    [BsonElement("canManageVersions")]
    public bool CanManageVersions { get; set; } = false;
}

public class Document
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("projectId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ProjectId { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("category")]
    public string? Category { get; set; }

    [BsonElement("discipline")]
    public string? Discipline { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;

    [BsonElement("currentVersionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CurrentVersionId { get; set; } = string.Empty;

    [BsonElement("versions")]
    public List<DocumentVersion> Versions { get; set; } = new();

    [BsonElement("permissions")]
    public PermissionMatrix Permissions { get; set; } = new();

    [BsonElement("pagePermissions")]
    public Dictionary<int, PermissionMatrix>? PagePermissions { get; set; }

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
