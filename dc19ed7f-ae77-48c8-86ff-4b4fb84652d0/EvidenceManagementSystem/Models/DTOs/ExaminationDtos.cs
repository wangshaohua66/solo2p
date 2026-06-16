using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.DTOs;

public class ExaminationTaskDto
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public string EvidenceBarcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public string TaskNumber { get; set; } = string.Empty;
    public string ExaminationType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ExaminerId { get; set; }
    public string ExaminerName { get; set; } = string.Empty;
    public Guid? ReviewerId { get; set; }
    public string? ReviewerName { get; set; }
    public ExaminationStatus Status { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? IssuedAt { get; set; }
    public string? InstrumentInfo { get; set; }
    public string? Conclusion { get; set; }
    public string? ReviewOpinion { get; set; }
    public string? RejectReason { get; set; }
    public int RevisionCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ExaminationRecordDto> ExaminationRecords { get; set; } = new();
}

public class ExaminationRecordDto
{
    public Guid Id { get; set; }
    public int RoundNumber { get; set; }
    public string RecordContent { get; set; } = string.Empty;
    public string? InstrumentUsed { get; set; }
    public string? AnalysisData { get; set; }
    public string? ImageHash { get; set; }
    public DateTime RecordedAt { get; set; }
    public Guid RecordedById { get; set; }
    public string RecordedByName { get; set; } = string.Empty;
}

public class CreateExaminationTaskRequest
{
    public Guid EvidenceId { get; set; }
    public string ExaminationType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ExaminerId { get; set; }
}

public class StartExaminationRequest
{
    public string? InstrumentInfo { get; set; }
}

public class AddExaminationRecordRequest
{
    public int RoundNumber { get; set; }
    public string RecordContent { get; set; } = string.Empty;
    public string? InstrumentUsed { get; set; }
    public string? AnalysisData { get; set; }
    public string? ImageHash { get; set; }
}

public class SubmitReportRequest
{
    public string Conclusion { get; set; } = string.Empty;
    public string ReportDraft { get; set; } = string.Empty;
}

public class ReviewReportRequest
{
    public bool IsApproved { get; set; }
    public string? Opinion { get; set; }
    public string? RejectReason { get; set; }
}

public class ExaminationQuery : PaginationQuery
{
    public ExaminationStatus? Status { get; set; }
    public Guid? ExaminerId { get; set; }
    public Guid? ReviewerId { get; set; }
    public Guid? EvidenceId { get; set; }
    public string? TaskNumber { get; set; }
    public string? Keyword { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
