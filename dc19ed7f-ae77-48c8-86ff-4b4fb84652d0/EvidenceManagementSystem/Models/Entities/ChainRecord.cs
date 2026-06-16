using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class ChainRecord
{
    public Guid Id { get; set; }
    public Guid EvidenceId { get; set; }
    public ChainOperationType OperationType { get; set; }
    public EvidenceStatus StatusBefore { get; set; }
    public EvidenceStatus StatusAfter { get; set; }
    public Guid OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public DateTime OperationTime { get; set; } = DateTime.UtcNow;
    public string? FromDepartment { get; set; }
    public string? ToDepartment { get; set; }
    public string? ImageHash { get; set; }
    public string? Remark { get; set; }
    public string PreviousRecordHash { get; set; } = string.Empty;
    public string RecordHash { get; set; } = string.Empty;
    public int SequenceNumber { get; set; }

    public Evidence Evidence { get; set; } = null!;
    public User Operator { get; set; } = null!;
}
