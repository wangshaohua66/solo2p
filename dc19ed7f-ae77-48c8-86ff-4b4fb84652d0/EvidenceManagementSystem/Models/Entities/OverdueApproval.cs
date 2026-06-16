using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class OverdueApproval
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public Guid WarningId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public string Justification { get; set; } = string.Empty;
    public DateTime ExpectedExpiryDate { get; set; }
    public int DaysOverdue { get; set; }
    public OverdueApprovalStatus Status { get; set; } = OverdueApprovalStatus.Pending;
    public Guid SubmittedById { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public Guid? ApprovedById { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovalRemark { get; set; }
    public string? RejectReason { get; set; }

    public Evidence Evidence { get; set; } = null!;
    public OverdueWarning Warning { get; set; } = null!;
    public User SubmittedBy { get; set; } = null!;
    public User? ApprovedBy { get; set; }
}
