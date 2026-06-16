using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class InventoryTask
{
    public Guid Id { get; set; }
    public string TaskNumber { get; set; } = string.Empty;
    public string? Warehouse { get; set; }
    public EvidenceCategory? Category { get; set; }
    public string? CaseNumber { get; set; }
    public InventoryStatus Status { get; set; } = InventoryStatus.Pending;
    public int TotalCount { get; set; }
    public int MatchedCount { get; set; }
    public int MismatchedCount { get; set; }
    public int MissingCount { get; set; }
    public int ExtraCount { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ExceptionReport { get; set; }
    public bool LeaderNotified { get; set; }

    public ICollection<InventoryItem> InventoryItems { get; set; } = new List<InventoryItem>();
}
