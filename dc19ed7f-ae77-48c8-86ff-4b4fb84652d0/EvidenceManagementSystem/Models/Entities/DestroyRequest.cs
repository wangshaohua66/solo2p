using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class DestroyRequest
{
    public Guid Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public Guid EvidenceId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public Guid RequestedById { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public Guid? ApprovedById { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public bool IsApproved { get; set; }
    public string? ApprovalOpinion { get; set; }
    public bool IsExecuted { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public string? Executor1Name { get; set; }
    public string? Executor2Name { get; set; }
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }

    public Evidence Evidence { get; set; } = null!;
}
