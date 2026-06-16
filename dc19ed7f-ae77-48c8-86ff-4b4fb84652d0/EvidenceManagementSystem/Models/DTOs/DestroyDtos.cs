namespace EvidenceManagementSystem.Models.DTOs;

public class DestroyRequestDto
{
    public Guid Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public Guid EvidenceId { get; set; }
    public string EvidenceBarcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public Guid RequestedById { get; set; }
    public string RequestedByName { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public Guid? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public bool IsApproved { get; set; }
    public string? ApprovalOpinion { get; set; }
    public bool IsExecuted { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public string? Executor1Name { get; set; }
    public string? Executor2Name { get; set; }
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
}

public class CreateDestroyRequestRequest
{
    public Guid EvidenceId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Remark { get; set; }
}

public class ApproveDestroyRequest
{
    public bool IsApproved { get; set; }
    public string? ApprovalOpinion { get; set; }
}

public class ExecuteDestroyRequest
{
    public string Executor1Name { get; set; } = string.Empty;
    public string Executor2Name { get; set; } = string.Empty;
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
}

public class DestroyQuery : PaginationQuery
{
    public bool? IsApproved { get; set; }
    public bool? IsExecuted { get; set; }
    public Guid? RequestedById { get; set; }
    public Guid? ApprovedById { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
