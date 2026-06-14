using BlueprintReview.Models;

namespace BlueprintReview.DTOs;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public UserRole Role { get; set; }
    public string? Department { get; set; }
}

public class CreateProjectRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? BuildingType { get; set; }
    public int? FloorCount { get; set; }
    public double? Area { get; set; }
    public List<string> MemberIds { get; set; } = new();
}

public class UpdateProjectRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? BuildingType { get; set; }
    public int? FloorCount { get; set; }
    public double? Area { get; set; }
    public string? Status { get; set; }
}

public class AddMemberRequest
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class UploadDocumentRequest
{
    public string ProjectId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Discipline { get; set; }
    public IFormFile? File { get; set; }
}

public class UploadVersionRequest
{
    public string? Description { get; set; }
    public IFormFile? File { get; set; }
}

public class CreateAnnotationRequest
{
    public string DocumentId { get; set; } = string.Empty;
    public string VersionId { get; set; } = string.Empty;
    public int PageNumber { get; set; }
    public AnnotationGeometry Geometry { get; set; } = new();
    public string Content { get; set; } = string.Empty;
    public AnnotationSeverity Severity { get; set; } = AnnotationSeverity.Medium;
    public string? AssigneeId { get; set; }
    public List<string> Mentions { get; set; } = new();
}

public class UpdateAnnotationRequest
{
    public string? Content { get; set; }
    public AnnotationStatus? Status { get; set; }
    public AnnotationSeverity? Severity { get; set; }
    public string? AssigneeId { get; set; }
}

public class AddReplyRequest
{
    public string Content { get; set; } = string.Empty;
    public List<string> Mentions { get; set; } = new();
}

public class MigrateAnnotationsRequest
{
    public List<string> AnnotationIds { get; set; } = new();
    public string TargetVersionId { get; set; } = string.Empty;
}

public class DetectConflictRequest
{
    public string DocumentId { get; set; } = string.Empty;
    public string VersionId { get; set; } = string.Empty;
    public int PageNumber { get; set; }
    public AnnotationGeometry Geometry { get; set; } = new();
}

public class ResolveConflictRequest
{
    public string Action { get; set; } = "merge";
}

public class CreateWorkflowRequest
{
    public string DocumentId { get; set; } = string.Empty;
    public string TemplateId { get; set; } = string.Empty;
}

public class ReviewerActionRequest
{
    public ReviewerAction Action { get; set; }
    public string Comment { get; set; } = string.Empty;
}

public class EscalateRequest
{
    public string ToUserId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class CreateWorkflowTemplateRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<ReviewStageConfig> Stages { get; set; } = new();
    public bool IsDefault { get; set; }
}
