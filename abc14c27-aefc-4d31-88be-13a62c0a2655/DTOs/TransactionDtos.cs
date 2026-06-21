using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.DTOs;

public class PagedQuery
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? SortField { get; set; }
    public string SortOrder { get; set; } = "desc";
}

#region Transaction DTOs

public class TransactionCreateDto
{
    public long VehicleId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string SellerIdNumber { get; set; } = string.Empty;
    public string? SellerPhone { get; set; }
    public string? SellerAddress { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string BuyerIdNumber { get; set; } = string.Empty;
    public string? BuyerPhone { get; set; }
    public string? BuyerAddress { get; set; }
    public decimal TransactionPrice { get; set; }
    public DateTime TransactionDate { get; set; }
    public string? TransactionLocation { get; set; }
    public long? InspectionOrderId { get; set; }
    public long? RegisteredBy { get; set; }
    public string? RegistrarName { get; set; }
    public string? Remark { get; set; }
}

public class TransactionUpdateDto
{
    public string? SellerName { get; set; }
    public string? SellerPhone { get; set; }
    public string? SellerAddress { get; set; }
    public string? BuyerName { get; set; }
    public string? BuyerPhone { get; set; }
    public string? BuyerAddress { get; set; }
    public decimal? TransactionPrice { get; set; }
    public DateTime? TransactionDate { get; set; }
    public string? TransactionLocation { get; set; }
    public string? Remark { get; set; }
}

public class TransactionQueryDto : PagedQuery
{
    public string? TransactionNo { get; set; }
    public long? VehicleId { get; set; }
    public string? Vin { get; set; }
    public string? BuyerName { get; set; }
    public string? SellerName { get; set; }
    public TransactionStatus? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class TransactionDto
{
    public long Id { get; set; }
    public string TransactionNo { get; set; } = string.Empty;
    public long VehicleId { get; set; }
    public string? Vin { get; set; }
    public string? PlateNumber { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string SellerIdNumber { get; set; } = string.Empty;
    public string? SellerPhone { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string BuyerIdNumber { get; set; } = string.Empty;
    public string? BuyerPhone { get; set; }
    public decimal TransactionPrice { get; set; }
    public DateTime TransactionDate { get; set; }
    public TransactionStatus Status { get; set; }
    public decimal? TaxAmount { get; set; }
    public decimal? ServiceFee { get; set; }
    public string? OldPlateNumber { get; set; }
    public string? NewPlateNumber { get; set; }
    public long? InspectionOrderId { get; set; }
    public string? RegistrarName { get; set; }
    public DateTime? RegistrationDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TransactionDetailDto : TransactionDto
{
    public VehicleDto? Vehicle { get; set; }
    public InspectionOrderDto? InspectionOrder { get; set; }
    public List<WorkflowInstanceDto>? WorkflowInstances { get; set; }
    public List<ArchiveFileDto>? Archives { get; set; }
}

#endregion

#region Workflow DTOs

public class WorkflowStartDto
{
    public long TransactionId { get; set; }
}

public class WorkflowNodeProcessDto
{
    public long NodeExecutionId { get; set; }
    public long ProcessorId { get; set; }
    public string? ProcessorName { get; set; }
    public string? ResultData { get; set; }
    public string? Remark { get; set; }
}

public class WorkflowNodeSkipDto
{
    public long NodeExecutionId { get; set; }
    public long ProcessorId { get; set; }
    public string? ProcessorName { get; set; }
    public string SkipReason { get; set; } = string.Empty;
}

public class WorkflowInstanceDto
{
    public long Id { get; set; }
    public long TransactionId { get; set; }
    public string InstanceNo { get; set; } = string.Empty;
    public int TotalNodes { get; set; }
    public int CompletedNodes { get; set; }
    public int CurrentNodeIndex { get; set; }
    public WorkflowNodeStatus Status { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? TotalDurationMinutes { get; set; }
    public bool HasTimedOutNodes { get; set; }
    public List<WorkflowNodeExecutionDto>? NodeExecutions { get; set; }
}

public class WorkflowNodeExecutionDto
{
    public long Id { get; set; }
    public long InstanceId { get; set; }
    public WorkflowNodeType NodeType { get; set; }
    public string NodeName { get; set; } = string.Empty;
    public string NodeNameEn { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsParallel { get; set; }
    public WorkflowNodeStatus Status { get; set; }
    public DateTime ScheduledEndTime { get; set; }
    public int TimeLimitMinutes { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationMinutes { get; set; }
    public long? AssignedTo { get; set; }
    public string? AssigneeName { get; set; }
    public string? ResultData { get; set; }
    public string? Remark { get; set; }
    public int ReminderCount { get; set; }
}

#endregion

#region Archive DTOs

public class ArchiveUploadDto
{
    public long? TransactionId { get; set; }
    public long? VehicleId { get; set; }
    public ArchiveType ArchiveType { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public IFormFile File { get; set; } = null!;
}

public class ArchiveBatchUploadDto
{
    public long? TransactionId { get; set; }
    public long? VehicleId { get; set; }
    public List<ArchiveItemUploadDto> Items { get; set; } = new();
}

public class ArchiveItemUploadDto
{
    public ArchiveType ArchiveType { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public IFormFile File { get; set; } = null!;
}

public class ArchiveSearchDto : PagedQuery
{
    public long? TransactionId { get; set; }
    public long? VehicleId { get; set; }
    public string? Vin { get; set; }
    public string? BuyerName { get; set; }
    public ArchiveType? ArchiveType { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Keyword { get; set; }
}

public class ArchiveFileDto
{
    public long Id { get; set; }
    public long? TransactionId { get; set; }
    public long? VehicleId { get; set; }
    public string? TransactionNo { get; set; }
    public string? Vin { get; set; }
    public ArchiveType ArchiveType { get; set; }
    public string ArchiveTypeName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string FileExtension { get; set; } = string.Empty;
    public bool OcrProcessed { get; set; }
    public string? Keywords { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class OcrResultDto
{
    public long ArchiveId { get; set; }
    public bool Success { get; set; }
    public string? OcrText { get; set; }
    public List<string>? Keywords { get; set; }
}

#endregion

#region Exception Case DTOs

public class ExceptionCaseCreateDto
{
    public ExceptionCaseType CaseType { get; set; }
    public long? VehicleId { get; set; }
    public long? TransactionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? SourceModule { get; set; }
    public long? AssignedTo { get; set; }
    public string? AssigneeName { get; set; }
    public DateTime? DueDate { get; set; }
    public int Priority { get; set; } = 1;
}

public class ExceptionCaseProcessDto
{
    public long CaseId { get; set; }
    public ExceptionCaseStatus NewStatus { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Remark { get; set; }
    public string? Resolution { get; set; }
}

public class ExceptionCaseQueryDto : PagedQuery
{
    public string? CaseNo { get; set; }
    public ExceptionCaseType? CaseType { get; set; }
    public ExceptionCaseStatus? Status { get; set; }
    public long? VehicleId { get; set; }
    public long? TransactionId { get; set; }
    public long? AssignedTo { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? Priority { get; set; }
}

public class ExceptionCaseDto
{
    public long Id { get; set; }
    public string CaseNo { get; set; } = string.Empty;
    public ExceptionCaseType CaseType { get; set; }
    public string CaseTypeName { get; set; } = string.Empty;
    public long? VehicleId { get; set; }
    public string? Vin { get; set; }
    public long? TransactionId { get; set; }
    public string? TransactionNo { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ExceptionCaseStatus Status { get; set; }
    public string? SourceModule { get; set; }
    public long? AssignedTo { get; set; }
    public string? AssigneeName { get; set; }
    public DateTime? DueDate { get; set; }
    public int Priority { get; set; }
    public int ProcessingCount { get; set; }
    public string? Resolution { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolverName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ExceptionCaseDetailDto : ExceptionCaseDto
{
    public List<ExceptionCaseLogDto>? ProcessingLogs { get; set; }
}

public class ExceptionCaseLogDto
{
    public long Id { get; set; }
    public long CaseId { get; set; }
    public ExceptionCaseStatus OldStatus { get; set; }
    public ExceptionCaseStatus NewStatus { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Remark { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

#endregion

#region Statistics DTOs

public class StatisticsQueryDto
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string? Granularity { get; set; } = "day";
}

public class TransactionStatisticsDto
{
    public int TotalTransactions { get; set; }
    public decimal TotalTransactionAmount { get; set; }
    public decimal AverageTransactionPrice { get; set; }
    public int PendingCount { get; set; }
    public int InProgressCount { get; set; }
    public int CompletedCount { get; set; }
}

public class BrandStatisticsDto
{
    public string Brand { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Percentage { get; set; }
}

public class ModelStatisticsDto
{
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalAmount { get; set; }
}

public class InspectionGradeStatisticsDto
{
    public InspectionGrade? Grade { get; set; }
    public string GradeName { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Percentage { get; set; }
    public decimal AverageScore { get; set; }
}

public class WorkflowTimelinessDto
{
    public int TotalInstances { get; set; }
    public int OnTimeCompleted { get; set; }
    public int TimedOut { get; set; }
    public double OnTimeRate { get; set; }
    public double AverageDurationMinutes { get; set; }
    public List<WorkflowNodeTimelinessDto> NodeTimeliness { get; set; } = new();
}

public class WorkflowNodeTimelinessDto
{
    public WorkflowNodeType NodeType { get; set; }
    public string NodeName { get; set; } = string.Empty;
    public int TotalExecutions { get; set; }
    public int OnTimeCount { get; set; }
    public int TimedOutCount { get; set; }
    public double OnTimeRate { get; set; }
    public double AverageDurationMinutes { get; set; }
}

public class ExceptionCaseStatisticsDto
{
    public int TotalCases { get; set; }
    public int OpenCases { get; set; }
    public int ResolvedCases { get; set; }
    public double ResolutionRate { get; set; }
    public double AverageResolutionDays { get; set; }
    public List<ExceptionCaseTypeStatisticsDto> TypeStatistics { get; set; } = new();
}

public class ExceptionCaseTypeStatisticsDto
{
    public ExceptionCaseType CaseType { get; set; }
    public string CaseTypeName { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Percentage { get; set; }
}

public class DailyStatisticsDto
{
    public DateTime Date { get; set; }
    public int NewVehicles { get; set; }
    public int ComplianceChecks { get; set; }
    public int Inspections { get; set; }
    public int Transactions { get; set; }
    public int NewExceptions { get; set; }
    public int ResolvedExceptions { get; set; }
}

public class WeeklyMonthlyReportDto
{
    public DateTime ReportStartDate { get; set; }
    public DateTime ReportEndDate { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public TransactionStatisticsDto TransactionSummary { get; set; } = new();
    public List<BrandStatisticsDto> BrandDistribution { get; set; } = new();
    public InspectionGradeStatisticsDto? GradeSummary { get; set; }
    public List<InspectionGradeStatisticsDto> GradeDistribution { get; set; } = new();
    public WorkflowTimelinessDto? WorkflowTimeliness { get; set; }
    public ExceptionCaseStatisticsDto? ExceptionSummary { get; set; }
    public List<DailyStatisticsDto> DailyTrend { get; set; } = new();
}

#endregion
