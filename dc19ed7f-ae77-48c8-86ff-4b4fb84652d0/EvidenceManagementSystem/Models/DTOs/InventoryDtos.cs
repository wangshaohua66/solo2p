using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.DTOs;

public class InventoryTaskDto
{
    public Guid Id { get; set; }
    public string TaskNumber { get; set; } = string.Empty;
    public string? Warehouse { get; set; }
    public EvidenceCategory? Category { get; set; }
    public string? CaseNumber { get; set; }
    public InventoryStatus Status { get; set; }
    public int TotalCount { get; set; }
    public int MatchedCount { get; set; }
    public int MismatchedCount { get; set; }
    public int MissingCount { get; set; }
    public int ExtraCount { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid CreatedById { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? ExceptionReport { get; set; }
    public bool LeaderNotified { get; set; }
}

public class InventoryItemDto
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public bool IsInSystem { get; set; }
    public bool IsScanned { get; set; }
    public bool IsMatched { get; set; }
    public string? Remark { get; set; }
    public DateTime? ScannedAt { get; set; }
}

public class CreateInventoryTaskRequest
{
    public string? Warehouse { get; set; }
    public EvidenceCategory? Category { get; set; }
    public string? CaseNumber { get; set; }
}

public class ScanInventoryItemRequest
{
    public string Barcode { get; set; } = string.Empty;
    public string? Remark { get; set; }
}

public class CompleteInventoryRequest
{
    public string? ExceptionReport { get; set; }
}

public class InventoryQuery : PaginationQuery
{
    public InventoryStatus? Status { get; set; }
    public string? Warehouse { get; set; }
    public EvidenceCategory? Category { get; set; }
    public string? CaseNumber { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
