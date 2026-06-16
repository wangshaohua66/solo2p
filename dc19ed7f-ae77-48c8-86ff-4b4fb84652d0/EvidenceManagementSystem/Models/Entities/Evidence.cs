using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class Evidence
{
    public Guid Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string CategoryCode { get; set; } = string.Empty;
    public EvidenceCategory Category { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CaseNumber { get; set; }
    public string? SuspectInfo { get; set; }
    public DateTime ExtractionTime { get; set; }
    public string ExtractionLocation { get; set; } = string.Empty;
    public string ExtractedBy { get; set; } = string.Empty;
    public string PackagingMethod { get; set; } = string.Empty;
    public StorageCondition StorageCondition { get; set; }
    public string? StorageLocation { get; set; }
    public string? ShelfNumber { get; set; }
    public EvidenceStatus Status { get; set; } = EvidenceStatus.Registered;
    public int StorageDaysLimit { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StorageStartTime { get; set; }
    public DateTime? ExpectedExpiryDate { get; set; }
    public bool IsOverdue { get; set; }
    public bool IsDestroyed { get; set; }
    public DateTime? DestroyedAt { get; set; }
    public Guid? DestroyApprovedBy { get; set; }
    public string? DestroyRemark { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid CreatedBy { get; set; }

    public ICollection<ChainRecord> ChainRecords { get; set; } = new List<ChainRecord>();
    public ICollection<ExaminationTask> ExaminationTasks { get; set; } = new List<ExaminationTask>();
    public ICollection<InventoryItem> InventoryItems { get; set; } = new List<InventoryItem>();
}
