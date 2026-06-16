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
