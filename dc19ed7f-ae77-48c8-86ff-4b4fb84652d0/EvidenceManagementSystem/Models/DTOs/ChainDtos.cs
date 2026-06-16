using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.DTOs;

public class ChainRecordDto
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public string EvidenceBarcode { get; set; } = string.Empty;
    public string EvidenceName { get; set; } = string.Empty;
    public ChainOperationType OperationType { get; set; }
    public EvidenceStatus StatusBefore { get; set; }
    public EvidenceStatus StatusAfter { get; set; }
    public Guid OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public DateTime OperationTime { get; set; }
    public string? FromDepartment { get; set; }
    public string? ToDepartment { get; set; }
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
    public int SequenceNumber { get; set; }
    public string RecordHash { get; set; } = string.Empty;
    public string PreviousRecordHash { get; set; } = string.Empty;
}

public class ChainQuery : PaginationQuery
{
    public Guid? EvidenceId { get; set; }
    public ChainOperationType? OperationType { get; set; }
    public Guid? OperatorId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
