namespace EvidenceManagementSystem.Models.Entities;

public class InventoryItem
{
    public Guid Id { get; set; }
    public Guid InventoryTaskId { get; set; }
    public Guid EvidenceId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public bool IsInSystem { get; set; }
    public bool IsScanned { get; set; }
    public bool IsMatched { get; set; }
    public string? Remark { get; set; }
    public DateTime? ScannedAt { get; set; }

    public InventoryTask InventoryTask { get; set; } = null!;
    public Evidence Evidence { get; set; } = null!;
}
