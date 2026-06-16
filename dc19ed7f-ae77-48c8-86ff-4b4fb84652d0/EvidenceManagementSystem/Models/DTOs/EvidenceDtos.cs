using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.DTOs;

public class EvidenceDto
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
    public EvidenceStatus Status { get; set; }
    public int StorageDaysLimit { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime? StorageStartTime { get; set; }
    public DateTime? ExpectedExpiryDate { get; set; }
    public bool IsOverdue { get; set; }
    public bool IsDestroyed { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateEvidenceRequest
{
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
    public int StorageDaysLimit { get; set; }
}

public class UpdateEvidenceRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? StorageLocation { get; set; }
    public string? ShelfNumber { get; set; }
    public StorageCondition? StorageCondition { get; set; }
}

public class EvidenceQuery : PaginationQuery
{
    public EvidenceCategory? Category { get; set; }
    public EvidenceStatus? Status { get; set; }
    public string? Barcode { get; set; }
    public string? CaseNumber { get; set; }
    public string? Keyword { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool? IsOverdue { get; set; }
}

public class InboundRequest
{
    public Guid EvidenceId { get; set; }
    public string StorageLocation { get; set; } = string.Empty;
    public string ShelfNumber { get; set; } = string.Empty;
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
}

public class OutboundRequest
{
    public Guid EvidenceId { get; set; }
    public string ToDepartment { get; set; } = string.Empty;
    public string Receiver { get; set; } = string.Empty;
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
}
