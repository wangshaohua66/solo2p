using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.Models;

public abstract class BaseEntity
{
    [Key]
    public long Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public long CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public long? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public long? DeletedBy { get; set; }

    [ConcurrencyCheck]
    [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
    public byte[]? RowVersion { get; set; }
}

[Table("vehicles")]
[Index(nameof(Vin), IsUnique = true)]
[Index(nameof(PlateNumber))]
[Index(nameof(Brand), nameof(Model))]
[Index(nameof(Status))]
public class Vehicle : BaseEntity
{
    [MaxLength(17)]
    public string Vin { get; set; } = string.Empty;

    [MaxLength(20)]
    public string PlateNumber { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Brand { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Model { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Series { get; set; }

    [MaxLength(10)]
    public string? Color { get; set; }

    public int? ManufactureYear { get; set; }
    public int? ManufactureMonth { get; set; }
    public DateTime? FirstRegistrationDate { get; set; }
    public int? Mileage { get; set; }

    [MaxLength(20)]
    public string? EngineNumber { get; set; }

    [MaxLength(20)]
    public string? FrameNumber { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? Displacement { get; set; }

    public int? Power { get; set; }

    [MaxLength(20)]
    public string? FuelType { get; set; }

    [MaxLength(20)]
    public string? Transmission { get; set; }

    [MaxLength(50)]
    public string? EnvironmentalStandard { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? EstimatedPrice { get; set; }

    public VehicleStatus Status { get; set; } = VehicleStatus.PendingCompliance;

    [MaxLength(500)]
    public string? Remark { get; set; }

    public virtual ICollection<ComplianceCheckRecord>? ComplianceCheckRecords { get; set; }
    public virtual ICollection<InspectionOrder>? InspectionOrders { get; set; }
    public virtual ICollection<VehicleTransaction>? Transactions { get; set; }
    public virtual ICollection<ArchiveFile>? Archives { get; set; }
    public virtual ICollection<ExceptionCase>? ExceptionCases { get; set; }
}

[Table("compliance_check_records")]
[Index(nameof(VehicleId))]
[Index(nameof(CheckBatchNo), IsUnique = true)]
[Index(nameof(CheckTime))]
public class ComplianceCheckRecord : BaseEntity
{
    public long VehicleId { get; set; }

    [MaxLength(50)]
    public string CheckBatchNo { get; set; } = string.Empty;

    public ComplianceCheckStatus OverallStatus { get; set; }

    public DateTime CheckTime { get; set; }

    public int TotalItems { get; set; }
    public int PassedItems { get; set; }
    public int FailedItems { get; set; }
    public int ExceptionItems { get; set; }

    [MaxLength(2000)]
    public string? FailureReasons { get; set; }

    public bool IsManualReviewed { get; set; } = false;
    public ReviewResult? ReviewResult { get; set; }
    public long? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    [MaxLength(500)]
    public string? ReviewRemark { get; set; }

    public bool HasExceptionApproval { get; set; } = false;
    public long? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(500)]
    public string? ApprovalRemark { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public virtual Vehicle? Vehicle { get; set; }
    public virtual ICollection<ComplianceCheckItem>? CheckItems { get; set; }
}

[Table("compliance_check_items")]
[Index(nameof(CheckRecordId))]
[Index(nameof(ItemType))]
public class ComplianceCheckItem : BaseEntity
{
    public long CheckRecordId { get; set; }

    public ComplianceItemType ItemType { get; set; }

    [MaxLength(100)]
    public string ItemName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ItemNameEn { get; set; } = string.Empty;

    public ComplianceCheckStatus Status { get; set; }

    public bool Passed { get; set; }

    [MaxLength(500)]
    public string? Detail { get; set; }

    [MaxLength(1000)]
    public string? RawData { get; set; }

    public int DurationMs { get; set; }

    [MaxLength(200)]
    public string? FailureReason { get; set; }

    [MaxLength(200)]
    public string? FailureReasonEn { get; set; }

    [MaxLength(100)]
    public string? SourceSystem { get; set; }

    [ForeignKey(nameof(CheckRecordId))]
    public virtual ComplianceCheckRecord? CheckRecord { get; set; }
}

[Table("inspection_items_library")]
[Index(nameof(Category))]
[Index(nameof(ItemCode), IsUnique = true)]
public class InspectionItemLibrary : BaseEntity
{
    [MaxLength(20)]
    public string ItemCode { get; set; } = string.Empty;

    public InspectionCategory Category { get; set; }

    [MaxLength(100)]
    public string ItemName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ItemNameEn { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; }
    public int MaxScore { get; set; } = 10;
    public decimal Weight { get; set; }

    [MaxLength(500)]
    public string? ScoreCriteria { get; set; }

    public bool Required { get; set; } = true;

    public bool AllowPhoto { get; set; } = true;
    public int? MinPhotos { get; set; }
    public int? MaxPhotos { get; set; }

    public bool IsActive { get; set; } = true;

    public virtual ICollection<InspectionItemResult>? ItemResults { get; set; }
}

[Table("inspection_orders")]
[Index(nameof(VehicleId))]
[Index(nameof(OrderNo), IsUnique = true)]
[Index(nameof(InspectorId))]
[Index(nameof(Status))]
[Index(nameof(CreatedAt))]
public class InspectionOrder : BaseEntity
{
    public long VehicleId { get; set; }

    [MaxLength(50)]
    public string OrderNo { get; set; } = string.Empty;

    public long InspectorId { get; set; }

    [MaxLength(50)]
    public string? InspectorName { get; set; }

    public InspectionStatus Status { get; set; } = InspectionStatus.Created;

    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationMinutes { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal EngineScore { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal ChassisScore { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal BodyScore { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal ElectricalScore { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal RoadTestScore { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal TotalScore { get; set; }

    public InspectionGrade? Grade { get; set; }

    [MaxLength(2000)]
    public string? GeneralComment { get; set; }

    [MaxLength(500)]
    public string? MajorIssues { get; set; }

    [MaxLength(500)]
    public string? SafetyConcerns { get; set; }

    public long? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    [MaxLength(500)]
    public string? ReviewComment { get; set; }

    [MaxLength(255)]
    public string? ReportFilePath { get; set; }

    [ForeignKey(nameof(VehicleId))]
    public virtual Vehicle? Vehicle { get; set; }
    public virtual ICollection<InspectionItemResult>? ItemResults { get; set; }
    public virtual ICollection<InspectionPhoto>? Photos { get; set; }
}

[Table("inspection_item_results")]
[Index(nameof(InspectionOrderId))]
[Index(nameof(InspectionItemId))]
public class InspectionItemResult : BaseEntity
{
    public long InspectionOrderId { get; set; }
    public long InspectionItemId { get; set; }

    public InspectionCategory Category { get; set; }

    public int Score { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(2000)]
    public string? Finding { get; set; }

    public bool HasDefect { get; set; }

    [MaxLength(100)]
    public string? DefectLevel { get; set; }

    public int PhotoCount { get; set; }

    [ForeignKey(nameof(InspectionOrderId))]
    public virtual InspectionOrder? InspectionOrder { get; set; }

    [ForeignKey(nameof(InspectionItemId))]
    public virtual InspectionItemLibrary? InspectionItem { get; set; }
}

[Table("inspection_photos")]
[Index(nameof(InspectionOrderId))]
[Index(nameof(ItemResultId))]
public class InspectionPhoto : BaseEntity
{
    public long InspectionOrderId { get; set; }
    public long? ItemResultId { get; set; }

    public InspectionCategory? Category { get; set; }

    [MaxLength(255)]
    public string FilePath { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? OriginalFileName { get; set; }

    public long FileSize { get; set; }

    [MaxLength(100)]
    public string? ContentType { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; }

    [ForeignKey(nameof(InspectionOrderId))]
    public virtual InspectionOrder? InspectionOrder { get; set; }
}
