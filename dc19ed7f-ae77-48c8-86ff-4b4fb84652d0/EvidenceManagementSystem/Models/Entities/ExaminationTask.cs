using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class ExaminationTask
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public string TaskNumber { get; set; } = string.Empty;
    public string ExaminationType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid ExaminerId { get; set; }
    public Guid? ReviewerId { get; set; }
    public ExaminationStatus Status { get; set; } = ExaminationStatus.Pending;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? IssuedAt { get; set; }
    public string? InstrumentInfo { get; set; }
    public string? ExaminationData { get; set; }
    public string? Conclusion { get; set; }
    public string? ReportDraft { get; set; }
    public string? ReviewOpinion { get; set; }
    public string? RejectReason { get; set; }
    public int RevisionCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Evidence Evidence { get; set; } = null!;
    public User Examiner { get; set; } = null!;
    public User? Reviewer { get; set; }
    public ICollection<ExaminationRecord> ExaminationRecords { get; set; } = new List<ExaminationRecord>();
}
