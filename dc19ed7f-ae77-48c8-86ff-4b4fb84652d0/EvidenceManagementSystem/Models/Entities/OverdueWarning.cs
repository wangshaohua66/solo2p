using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class OverdueWarning
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
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public bool Notified { get; set; }
    public DateTime? NotifiedAt { get; set; }
    public bool Resolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolveRemark { get; set; }

    public Evidence Evidence { get; set; } = null!;
}
