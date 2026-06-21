using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.DTOs;

#region Vehicle DTOs

public class VehicleCreateDto
{
    public string Vin { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Series { get; set; }
    public string? Color { get; set; }
    public int? ManufactureYear { get; set; }
    public int? ManufactureMonth { get; set; }
    public DateTime? FirstRegistrationDate { get; set; }
    public int? Mileage { get; set; }
    public string? EngineNumber { get; set; }
    public string? FrameNumber { get; set; }
    public decimal? Displacement { get; set; }
    public int? Power { get; set; }
    public string? FuelType { get; set; }
    public string? Transmission { get; set; }
    public string? EnvironmentalStandard { get; set; }
    public decimal? EstimatedPrice { get; set; }
    public string? Remark { get; set; }
}

public class VehicleUpdateDto
{
    public string? PlateNumber { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? Series { get; set; }
    public string? Color { get; set; }
    public int? ManufactureYear { get; set; }
    public int? ManufactureMonth { get; set; }
    public DateTime? FirstRegistrationDate { get; set; }
    public int? Mileage { get; set; }
    public string? EngineNumber { get; set; }
    public string? FrameNumber { get; set; }
    public decimal? Displacement { get; set; }
    public int? Power { get; set; }
    public string? FuelType { get; set; }
    public string? Transmission { get; set; }
    public string? EnvironmentalStandard { get; set; }
    public decimal? EstimatedPrice { get; set; }
    public string? Remark { get; set; }
}

public class VehicleQueryDto : PagedQuery
{
    public string? Vin { get; set; }
    public string? PlateNumber { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public VehicleStatus? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class VehicleDto
{
    public long Id { get; set; }
    public string Vin { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Series { get; set; }
    public string? Color { get; set; }
    public int? ManufactureYear { get; set; }
    public int? ManufactureMonth { get; set; }
    public DateTime? FirstRegistrationDate { get; set; }
    public int? Mileage { get; set; }
    public string? EngineNumber { get; set; }
    public string? FrameNumber { get; set; }
    public decimal? Displacement { get; set; }
    public int? Power { get; set; }
    public string? FuelType { get; set; }
    public string? Transmission { get; set; }
    public string? EnvironmentalStandard { get; set; }
    public decimal? EstimatedPrice { get; set; }
    public VehicleStatus Status { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VehicleDetailDto : VehicleDto
{
    public List<ComplianceCheckRecordDto>? ComplianceRecords { get; set; }
    public List<InspectionOrderDto>? InspectionOrders { get; set; }
}

#endregion

#region Compliance DTOs

public class ComplianceCheckRequestDto
{
    public string Vin { get; set; } = string.Empty;
    public long? VehicleId { get; set; }
}

public class ComplianceCheckItemResultDto
{
    public ComplianceItemType ItemType { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string ItemNameEn { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public ComplianceCheckStatus Status { get; set; }
    public string? Detail { get; set; }
    public int DurationMs { get; set; }
    public string? FailureReason { get; set; }
    public string? FailureReasonEn { get; set; }
    public string? SourceSystem { get; set; }
}

public class ComplianceCheckResultDto
{
    public long RecordId { get; set; }
    public string CheckBatchNo { get; set; } = string.Empty;
    public long VehicleId { get; set; }
    public ComplianceCheckStatus OverallStatus { get; set; }
    public DateTime CheckTime { get; set; }
    public int TotalItems { get; set; }
    public int PassedItems { get; set; }
    public int FailedItems { get; set; }
    public int ExceptionItems { get; set; }
    public List<string> FailureReasons { get; set; } = new();
    public List<ComplianceCheckItemResultDto> Items { get; set; } = new();
    public bool IsManualReviewed { get; set; }
    public ReviewResult? ReviewResult { get; set; }
    public bool HasExceptionApproval { get; set; }
}

public class ComplianceCheckRecordDto
{
    public long Id { get; set; }
    public long VehicleId { get; set; }
    public string CheckBatchNo { get; set; } = string.Empty;
    public ComplianceCheckStatus OverallStatus { get; set; }
    public DateTime CheckTime { get; set; }
    public int TotalItems { get; set; }
    public int PassedItems { get; set; }
    public int FailedItems { get; set; }
    public int ExceptionItems { get; set; }
    public string? FailureReasons { get; set; }
    public bool IsManualReviewed { get; set; }
    public ReviewResult? ReviewResult { get; set; }
    public long? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public bool HasExceptionApproval { get; set; }
    public long? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public List<ComplianceCheckItemResultDto>? Items { get; set; }
}

public class ComplianceReviewDto
{
    public long RecordId { get; set; }
    public ReviewResult Result { get; set; }
    public string? Remark { get; set; }
}

public class ComplianceExceptionApprovalDto
{
    public long RecordId { get; set; }
    public string? ApprovalRemark { get; set; }
}

#endregion

#region Inspection DTOs

public class InspectionOrderCreateDto
{
    public long VehicleId { get; set; }
    public long InspectorId { get; set; }
    public string? InspectorName { get; set; }
}

public class InspectionItemScoreDto
{
    public long InspectionItemId { get; set; }
    public InspectionCategory Category { get; set; }
    public int Score { get; set; }
    public string? Description { get; set; }
    public string? Finding { get; set; }
    public bool HasDefect { get; set; }
    public string? DefectLevel { get; set; }
    public int PhotoCount { get; set; }
    public List<IFormFile>? Photos { get; set; }
}

public class InspectionSubmitDto
{
    public long OrderId { get; set; }
    public string? GeneralComment { get; set; }
    public string? MajorIssues { get; set; }
    public string? SafetyConcerns { get; set; }
    public List<InspectionItemScoreDto> ItemScores { get; set; } = new();
}

public class InspectionReviewDto
{
    public long OrderId { get; set; }
    public bool Approved { get; set; }
    public string? ReviewComment { get; set; }
}

public class InspectionOrderDto
{
    public long Id { get; set; }
    public long VehicleId { get; set; }
    public string OrderNo { get; set; } = string.Empty;
    public long InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public InspectionStatus Status { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationMinutes { get; set; }
    public decimal EngineScore { get; set; }
    public decimal ChassisScore { get; set; }
    public decimal BodyScore { get; set; }
    public decimal ElectricalScore { get; set; }
    public decimal RoadTestScore { get; set; }
    public decimal TotalScore { get; set; }
    public InspectionGrade? Grade { get; set; }
    public string? GeneralComment { get; set; }
    public string? MajorIssues { get; set; }
    public string? SafetyConcerns { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReportFilePath { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InspectionOrderDetailDto : InspectionOrderDto
{
    public VehicleDto? Vehicle { get; set; }
    public List<InspectionItemResultDto>? ItemResults { get; set; }
    public List<InspectionPhotoDto>? Photos { get; set; }
}

public class InspectionItemResultDto
{
    public long Id { get; set; }
    public long InspectionItemId { get; set; }
    public InspectionCategory Category { get; set; }
    public string? ItemCode { get; set; }
    public string? ItemName { get; set; }
    public string? ItemNameEn { get; set; }
    public int Score { get; set; }
    public int MaxScore { get; set; }
    public decimal Weight { get; set; }
    public string? Description { get; set; }
    public string? Finding { get; set; }
    public bool HasDefect { get; set; }
    public string? DefectLevel { get; set; }
    public int PhotoCount { get; set; }
}

public class InspectionPhotoDto
{
    public long Id { get; set; }
    public long? ItemResultId { get; set; }
    public InspectionCategory? Category { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string? OriginalFileName { get; set; }
    public long FileSize { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class InspectionItemLibraryDto
{
    public long Id { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public InspectionCategory Category { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string ItemNameEn { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public int MaxScore { get; set; }
    public decimal Weight { get; set; }
    public string? ScoreCriteria { get; set; }
    public bool Required { get; set; }
    public bool AllowPhoto { get; set; }
    public int? MinPhotos { get; set; }
    public int? MaxPhotos { get; set; }
}

public class InspectionQueryDto : PagedQuery
{
    public long? VehicleId { get; set; }
    public long? InspectorId { get; set; }
    public InspectionStatus? Status { get; set; }
    public InspectionGrade? Grade { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

#endregion
