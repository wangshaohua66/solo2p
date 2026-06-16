using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.DTOs;

public class OverdueWarningDto
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public EvidenceCategory Category { get; set; }
    public DateTime ExpectedExpiryDate { get; set; }
    public int DaysRemaining { get; set; }
    public bool IsWarning { get; set; }
    public bool IsOverdue { get; set; }
    public DateTime GeneratedAt { get; set; }
    public bool Notified { get; set; }
    public DateTime? NotifiedAt { get; set; }
    public bool Resolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolveRemark { get; set; }
}

public class OverdueWarningQuery : PaginationQuery
{
    public bool? IsWarning { get; set; }
    public bool? IsOverdue { get; set; }
    public EvidenceCategory? Category { get; set; }
    public bool? Notified { get; set; }
    public bool? Resolved { get; set; }
}

public class OverdueApprovalDto
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public Guid WarningId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public string Justification { get; set; } = string.Empty;
    public DateTime ExpectedExpiryDate { get; set; }
    public int DaysOverdue { get; set; }
    public OverdueApprovalStatus Status { get; set; }
    public Guid SubmittedById { get; set; }
    public string SubmittedByName { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public Guid? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovalRemark { get; set; }
    public string? RejectReason { get; set; }
}

public class SubmitOverdueApprovalRequest
{
    public Guid WarningId { get; set; }
    public string Justification { get; set; } = string.Empty;
}

public class ApproveOverdueRequest
{
    public string ApprovalRemark { get; set; } = string.Empty;
}

public class RejectOverdueRequest
{
    public string RejectReason { get; set; } = string.Empty;
}

public class OverdueApprovalQuery : PaginationQuery
{
    public OverdueApprovalStatus? Status { get; set; }
    public Guid? SubmittedById { get; set; }
    public Guid? ApprovedById { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
