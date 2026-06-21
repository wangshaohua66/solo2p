using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.Services;

public interface IVehicleService
{
    Task<ApiResponse<VehicleDto>> CreateAsync(VehicleCreateDto dto, long operatorId);
    Task<ApiResponse<VehicleDto>> UpdateAsync(long id, VehicleUpdateDto dto, long operatorId);
    Task<ApiResponse<bool>> DeleteAsync(long id, long operatorId);
    Task<ApiResponse<VehicleDetailDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<VehicleDto>>> QueryAsync(VehicleQueryDto dto);
}

public interface IComplianceService
{
    Task<ApiResponse<ComplianceCheckResultDto>> CheckComplianceAsync(ComplianceCheckRequestDto dto, long operatorId);
    Task<ApiResponse<ComplianceCheckRecordDto>> GetRecordByIdAsync(long recordId);
    Task<ApiResponse<PagedResult<ComplianceCheckRecordDto>>> GetRecordsByVehicleIdAsync(long vehicleId, int pageIndex = 1, int pageSize = 20);
    Task<ApiResponse<ComplianceCheckResultDto>> ManualReviewAsync(ComplianceReviewDto dto, long operatorId);
    Task<ApiResponse<ComplianceCheckResultDto>> ExceptionApprovalAsync(ComplianceExceptionApprovalDto dto, long operatorId);
}

public interface IInspectionService
{
    Task<ApiResponse<InspectionOrderDto>> CreateOrderAsync(InspectionOrderCreateDto dto, long operatorId);
    Task<ApiResponse<InspectionOrderDto>> StartInspectionAsync(long orderId, long inspectorId);
    Task<ApiResponse<InspectionOrderDetailDto>> SubmitInspectionAsync(InspectionSubmitDto dto, long operatorId);
    Task<ApiResponse<InspectionOrderDetailDto>> ReviewInspectionAsync(InspectionReviewDto dto, long operatorId);
    Task<ApiResponse<InspectionOrderDetailDto>> GetOrderByIdAsync(long orderId);
    Task<ApiResponse<PagedResult<InspectionOrderDto>>> QueryOrdersAsync(InspectionQueryDto dto);
    Task<ApiResponse<List<InspectionItemLibraryDto>>> GetItemLibraryByCategoryAsync(InspectionCategory? category = null);
    Task<ApiResponse<byte[]>> GenerateReportAsync(long orderId);
    Task<ApiResponse<bool>> CancelOrderAsync(long orderId, long operatorId);
}

public interface IArchiveService
{
    Task<ApiResponse<ArchiveFileDto>> UploadAsync(ArchiveUploadDto dto, long operatorId);
    Task<ApiResponse<List<ArchiveFileDto>>> BatchUploadAsync(ArchiveBatchUploadDto dto, long operatorId);
    Task<ApiResponse<PagedResult<ArchiveFileDto>>> SearchAsync(ArchiveSearchDto dto);
    Task<ApiResponse<ArchiveFileDto>> GetByIdAsync(long id);
    Task<ApiResponse<bool>> DeleteAsync(long id, long operatorId);
    Task<ApiResponse<List<ArchiveFileDto>>> GetByTransactionIdAsync(long transactionId);
    Task<ApiResponse<List<ArchiveFileDto>>> GetByVehicleIdAsync(long vehicleId);
    Task<ApiResponse<OcrResultDto>> ProcessOcrAsync(long archiveId, long operatorId);
    Task<ApiResponse<(string FilePath, string FileName)>> DownloadAsync(long archiveId);
}

public interface IWorkflowService
{
    Task<ApiResponse<WorkflowInstanceDto>> StartWorkflowAsync(WorkflowStartDto dto, long operatorId);
    Task<ApiResponse<WorkflowNodeExecutionDto>> ProcessNodeAsync(WorkflowNodeProcessDto dto, long operatorId);
    Task<ApiResponse<WorkflowNodeExecutionDto>> SkipNodeAsync(WorkflowNodeSkipDto dto, long operatorId);
    Task<ApiResponse<WorkflowInstanceDto>> GetInstanceByIdAsync(long instanceId);
    Task<ApiResponse<List<WorkflowInstanceDto>>> GetInstancesByTransactionIdAsync(long transactionId);
    Task<ApiResponse<WorkflowInstanceDto>> GetCurrentStatusAsync(long transactionId);
    Task<ApiResponse<int>> CheckTimeoutAndSendReminderAsync();
}

public interface ITransactionService
{
    Task<ApiResponse<TransactionDto>> CreateAsync(TransactionCreateDto dto, long operatorId);
    Task<ApiResponse<TransactionDto>> UpdateAsync(long id, TransactionUpdateDto dto, long operatorId);
    Task<ApiResponse<TransactionDetailDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<TransactionDto>>> QueryAsync(TransactionQueryDto dto);
    Task<ApiResponse<TransactionDto>> UpdateStatusAsync(long id, TransactionStatus status, long operatorId);
    Task<ApiResponse<bool>> CancelAsync(long id, long operatorId, string reason);
}

public interface IExceptionCaseService
{
    Task<ApiResponse<ExceptionCaseDto>> CreateAsync(ExceptionCaseCreateDto dto, long operatorId);
    Task<ApiResponse<ExceptionCaseDetailDto>> ProcessAsync(ExceptionCaseProcessDto dto, long operatorId);
    Task<ApiResponse<ExceptionCaseDetailDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<ExceptionCaseDto>>> QueryAsync(ExceptionCaseQueryDto dto);
    Task<ApiResponse<bool>> AssignAsync(long caseId, long assigneeId, string? assigneeName, long operatorId);
    Task<ApiResponse<List<ExceptionCaseLogDto>>> GetProcessingLogsAsync(long caseId);
    Task<ApiResponse<byte[]>> ExportAsync(ExceptionCaseQueryDto dto);
}

public interface IStatisticsService
{
    Task<ApiResponse<TransactionStatisticsDto>> GetTransactionStatisticsAsync(StatisticsQueryDto dto);
    Task<ApiResponse<List<BrandStatisticsDto>>> GetBrandStatisticsAsync(StatisticsQueryDto dto);
    Task<ApiResponse<List<ModelStatisticsDto>>> GetModelStatisticsAsync(StatisticsQueryDto dto, int topN = 20);
    Task<ApiResponse<List<InspectionGradeStatisticsDto>>> GetInspectionGradeStatisticsAsync(StatisticsQueryDto dto);
    Task<ApiResponse<WorkflowTimelinessDto>> GetWorkflowTimelinessAsync(StatisticsQueryDto dto);
    Task<ApiResponse<ExceptionCaseStatisticsDto>> GetExceptionCaseStatisticsAsync(StatisticsQueryDto dto);
    Task<ApiResponse<List<DailyStatisticsDto>>> GetDailyTrendAsync(StatisticsQueryDto dto);
    Task<ApiResponse<WeeklyMonthlyReportDto>> GetWeeklyMonthlyReportAsync(StatisticsQueryDto dto, string reportType = "weekly");
}
