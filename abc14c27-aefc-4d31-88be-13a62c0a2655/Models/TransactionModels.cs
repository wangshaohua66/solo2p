using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.Models;

[Table("vehicle_transactions")]
[Index(nameof(TransactionNo), IsUnique = true)]
[Index(nameof(VehicleId))]
[Index(nameof(BuyerName))]
[Index(nameof(SellerName))]
[Index(nameof(Status))]
[Index(nameof(TransactionDate))]
public class VehicleTransaction : BaseEntity
{
    [MaxLength(50)]
    public string TransactionNo { get; set; } = string.Empty;

    public long VehicleId { get; set; }

    [MaxLength(50)]
    public string SellerName { get; set; } = string.Empty;

    [MaxLength(18)]
    public string SellerIdNumber { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? SellerPhone { get; set; }

    [MaxLength(200)]
    public string? SellerAddress { get; set; }

    [MaxLength(50)]
    public string BuyerName { get; set; } = string.Empty;

    [MaxLength(18)]
    public string BuyerIdNumber { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? BuyerPhone { get; set; }

    [MaxLength(200)]
    public string? BuyerAddress { get; set; }

    [Column(TypeName = "decimal(12,2)")]
    public decimal TransactionPrice { get; set; }

    public DateTime TransactionDate { get; set; }

    [MaxLength(100)]
    public string? TransactionLocation { get; set; }

    public long? InspectionOrderId { get; set; }

    public TransactionStatus Status { get; set; } = TransactionStatus.Created;

    [Column(TypeName = "decimal(12,2)")]
    public decimal? TaxAmount { get; set; }

    [Column(TypeName = "decimal(12,2)")]
    public decimal? ServiceFee { get; set; }

    [MaxLength(50)]
    public string? OldPlateNumber { get; set; }

    [MaxLength(50)]
    public string? NewPlateNumber { get; set; }

    public long? RegisteredBy { get; set; }

    [MaxLength(50)]
    public string? RegistrarName { get; set; }

    public DateTime? RegistrationDate { get; set; }

    [MaxLength(500)]
    public string? Remark { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public virtual Vehicle? Vehicle { get; set; }

    [ForeignKey(nameof(InspectionOrderId))]
    public virtual InspectionOrder? InspectionOrder { get; set; }

    public virtual ICollection<WorkflowInstance>? WorkflowInstances { get; set; }
    public virtual ICollection<ArchiveFile>? Archives { get; set; }
}

[Table("workflow_instances")]
[Index(nameof(TransactionId))]
[Index(nameof(Status))]
public class WorkflowInstance : BaseEntity
{
    public long TransactionId { get; set; }

    [MaxLength(50)]
    public string InstanceNo { get; set; } = string.Empty;

    public int TotalNodes { get; set; }
    public int CompletedNodes { get; set; }
    public int CurrentNodeIndex { get; set; } = 0;

    public WorkflowNodeStatus Status { get; set; } = WorkflowNodeStatus.Pending;

    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? TotalDurationMinutes { get; set; }

    public bool HasTimedOutNodes { get; set; } = false;

    [MaxLength(500)]
    public string? Remark { get; set; }

    [ForeignKey(nameof(TransactionId))]
    public virtual VehicleTransaction? Transaction { get; set; }

    public virtual ICollection<WorkflowNodeExecution>? NodeExecutions { get; set; }
}

[Table("workflow_node_executions")]
[Index(nameof(InstanceId))]
[Index(nameof(NodeType))]
[Index(nameof(Status))]
[Index(nameof(ScheduledEndTime))]
public class WorkflowNodeExecution : BaseEntity
{
    public long InstanceId { get; set; }

    public WorkflowNodeType NodeType { get; set; }

    [MaxLength(100)]
    public string NodeName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string NodeNameEn { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public bool IsParallel { get; set; } = false;

    [MaxLength(500)]
    public string? Prerequisites { get; set; }

    public WorkflowNodeStatus Status { get; set; } = WorkflowNodeStatus.Pending;

    public DateTime? ScheduledStartTime { get; set; }
    public DateTime ScheduledEndTime { get; set; }

    public int TimeLimitMinutes { get; set; }

    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationMinutes { get; set; }

    public long? AssignedTo { get; set; }

    [MaxLength(50)]
    public string? AssigneeName { get; set; }

    public long? CompletedBy { get; set; }

    [MaxLength(50)]
    public string? CompleterName { get; set; }

    [MaxLength(1000)]
    public string? ResultData { get; set; }

    [MaxLength(500)]
    public string? Remark { get; set; }

    public int ReminderCount { get; set; } = 0;
    public DateTime? LastReminderTime { get; set; }

    [ForeignKey(nameof(InstanceId))]
    public virtual WorkflowInstance? Instance { get; set; }
}

[Table("archive_files")]
[Index(nameof(TransactionId))]
[Index(nameof(VehicleId))]
[Index(nameof(ArchiveType))]
[Index(nameof(FileHash))]
[Index(nameof(CreatedAt))]
public class ArchiveFile : BaseEntity
{
    public long? TransactionId { get; set; }

    public long? VehicleId { get; set; }

    public ArchiveType ArchiveType { get; set; }

    [MaxLength(100)]
    public string ArchiveTypeName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string FilePath { get; set; } = string.Empty;

    public long FileSize { get; set; }

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    [MaxLength(50)]
    public string FileExtension { get; set; } = string.Empty;

    [MaxLength(64)]
    public string? FileHash { get; set; }

    public bool OcrProcessed { get; set; } = false;

    [Column(TypeName = "text")]
    public string? OcrText { get; set; }

    [MaxLength(500)]
    public string? Keywords { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [ForeignKey(nameof(TransactionId))]
    public virtual VehicleTransaction? Transaction { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public virtual Vehicle? Vehicle { get; set; }
}

[Table("exception_cases")]
[Index(nameof(CaseNo), IsUnique = true)]
[Index(nameof(VehicleId))]
[Index(nameof(TransactionId))]
[Index(nameof(CaseType))]
[Index(nameof(Status))]
[Index(nameof(CreatedAt))]
public class ExceptionCase : BaseEntity
{
    [MaxLength(50)]
    public string CaseNo { get; set; } = string.Empty;

    public ExceptionCaseType CaseType { get; set; }

    [MaxLength(100)]
    public string CaseTypeName { get; set; } = string.Empty;

    public long? VehicleId { get; set; }

    public long? TransactionId { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string Description { get; set; } = string.Empty;

    public ExceptionCaseStatus Status { get; set; } = ExceptionCaseStatus.Created;

    [MaxLength(50)]
    public string? SourceModule { get; set; }

    public long? AssignedTo { get; set; }

    [MaxLength(50)]
    public string? AssigneeName { get; set; }

    public DateTime? DueDate { get; set; }

    public int Priority { get; set; } = 1;

    public int ProcessingCount { get; set; } = 0;

    [MaxLength(500)]
    public string? Resolution { get; set; }

    public DateTime? ResolvedAt { get; set; }
    public long? ResolvedBy { get; set; }

    [MaxLength(50)]
    public string? ResolverName { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public virtual Vehicle? Vehicle { get; set; }

    [ForeignKey(nameof(TransactionId))]
    public virtual VehicleTransaction? Transaction { get; set; }

    public virtual ICollection<ExceptionCaseLog>? ProcessingLogs { get; set; }
}

[Table("exception_case_logs")]
[Index(nameof(CaseId))]
public class ExceptionCaseLog : BaseEntity
{
    public long CaseId { get; set; }

    public ExceptionCaseStatus OldStatus { get; set; }
    public ExceptionCaseStatus NewStatus { get; set; }

    [MaxLength(1000)]
    public string Action { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string? Remark { get; set; }

    public long OperatorId { get; set; }

    [MaxLength(50)]
    public string OperatorName { get; set; } = string.Empty;

    [ForeignKey(nameof(CaseId))]
    public virtual ExceptionCase? Case { get; set; }
}

[Table("system_users")]
[Index(nameof(Username), IsUnique = true)]
[Index(nameof(EmployeeNo), IsUnique = true)]
[Index(nameof(Role))]
public class SystemUser : BaseEntity
{
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [MaxLength(50)]
    public string EmployeeNo { get; set; } = string.Empty;

    [MaxLength(50)]
    public string RealName { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Department { get; set; }

    public bool IsActive { get; set; } = true;
}
