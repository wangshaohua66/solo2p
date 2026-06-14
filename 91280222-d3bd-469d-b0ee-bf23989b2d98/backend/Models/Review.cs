using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BlueprintReview.Models;

public enum ReviewStatus
{
    [BsonRepresentation(BsonType.String)]
    Pending,

    [BsonRepresentation(BsonType.String)]
    InProgress,

    [BsonRepresentation(BsonType.String)]
    Approved,

    [BsonRepresentation(BsonType.String)]
    Rejected,

    [BsonRepresentation(BsonType.String)]
    NeedsRevision,

    [BsonRepresentation(BsonType.String)]
    Escalated
}

public enum ApprovalMode
{
    [BsonRepresentation(BsonType.String)]
    And,

    [BsonRepresentation(BsonType.String)]
    Or
}

public enum ReviewerAction
{
    [BsonRepresentation(BsonType.String)]
    Approve,

    [BsonRepresentation(BsonType.String)]
    Reject,

    [BsonRepresentation(BsonType.String)]
    RequestRevision,

    [BsonRepresentation(BsonType.String)]
    Escalate
}

public class ReviewStageConfig
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("order")]
    public int Order { get; set; }

    [BsonElement("mode")]
    [BsonRepresentation(BsonType.String)]
    public ApprovalMode Mode { get; set; } = ApprovalMode.And;

    [BsonElement("requiredApprovalCount")]
    public int? RequiredApprovalCount { get; set; }

    [BsonElement("reviewers")]
    public List<string> Reviewers { get; set; } = new();

    [BsonElement("reviewerNames")]
    public List<string> ReviewerNames { get; set; } = new();

    [BsonElement("deadlineHours")]
    public int? DeadlineHours { get; set; }

    [BsonElement("requireComment")]
    public bool RequireComment { get; set; } = true;
}

public class ReviewerRecord
{
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("action")]
    [BsonRepresentation(BsonType.String)]
    public ReviewerAction? Action { get; set; }

    [BsonElement("comment")]
    public string? Comment { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public ReviewStatus Status { get; set; } = ReviewStatus.Pending;

    [BsonElement("completedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("assignedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

public class ReviewStage
{
    [BsonElement("id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("config")]
    public ReviewStageConfig Config { get; set; } = new();

    [BsonElement("reviewers")]
    public List<ReviewerRecord> Reviewers { get; set; } = new();

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public ReviewStatus Status { get; set; } = ReviewStatus.Pending;

    [BsonElement("startedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? StartedAt { get; set; }

    [BsonElement("completedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("isCurrent")]
    public bool IsCurrent { get; set; }

    [BsonElement("isCompleted")]
    public bool IsCompleted { get; set; }
}

public class ReviewWorkflowTemplate
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("stages")]
    public List<ReviewStageConfig> Stages { get; set; } = new();

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("createdBy")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CreatedBy { get; set; } = string.Empty;

    [BsonElement("isDefault")]
    public bool IsDefault { get; set; }
}

public class EscalationRecord
{
    [BsonElement("fromUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string FromUserId { get; set; } = string.Empty;

    [BsonElement("fromUserName")]
    public string FromUserName { get; set; } = string.Empty;

    [BsonElement("toUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ToUserId { get; set; } = string.Empty;

    [BsonElement("toUserName")]
    public string ToUserName { get; set; } = string.Empty;

    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    [BsonElement("timestamp")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class ReviewWorkflow
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("documentId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string DocumentId { get; set; } = string.Empty;

    [BsonElement("documentName")]
    public string DocumentName { get; set; } = string.Empty;

    [BsonElement("templateId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string TemplateId { get; set; } = string.Empty;

    [BsonElement("templateName")]
    public string TemplateName { get; set; } = string.Empty;

    [BsonElement("stages")]
    public List<ReviewStage> Stages { get; set; } = new();

    [BsonElement("currentStageIndex")]
    public int CurrentStageIndex { get; set; }

    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public ReviewStatus Status { get; set; } = ReviewStatus.Pending;

    [BsonElement("initiatorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string InitiatorId { get; set; } = string.Empty;

    [BsonElement("initiatorName")]
    public string InitiatorName { get; set; } = string.Empty;

    [BsonElement("startedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("completedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("escalationHistory")]
    public List<EscalationRecord> EscalationHistory { get; set; } = new();

    [BsonElement("isCancelled")]
    public bool IsCancelled { get; set; }
}
