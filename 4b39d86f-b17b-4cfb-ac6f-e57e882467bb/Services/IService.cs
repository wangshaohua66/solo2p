using HazChemSupervision.DTOs;
using HazChemSupervision.Models;

namespace HazChemSupervision.Services;

public interface IComplianceService
{
    Task<ComplianceReportDto> GenerateMonthlyReportAsync(int year, int month, int? enterpriseId = null);
    Task<CertificateVerificationResultDto> VerifyCertificateAsync(CertificateVerifyDto dto);
    Task<bool> ValidateOperatorCertificateAsync(int operatorId, string certificateType, string? certificateNo = null);
    Task<decimal> CalculateEnterpriseComplianceScoreAsync(int enterpriseId, int year, int month);
    Task<List<ComplianceReportDto>> GenerateBatchReportsAsync(int year, int month);
}

public interface IAlertService
{
    Task<AlertDto> CreateAlertAsync(AlertCreateDto dto);
    Task<List<AlertDto>> CreateBatchAlertsAsync(List<AlertCreateDto> dtos);
    Task<AlertDto?> GetAlertByIdAsync(int id);
    Task<PagedResult<AlertDto>> GetAlertsAsync(AlertQueryDto dto);
    Task<bool> MarkAsReadAsync(int id);
    Task<bool> MarkAsHandledAsync(int id, AlertHandleDto dto);
    Task<int> GetUnreadCountAsync(int? userId = null, string? role = null);
    Task CheckAndGenerateInventoryAlertsAsync();
    Task CheckAndGenerateTransportAlertsAsync();
    Task CheckAndGenerateHazardAlertsAsync();
    Task CheckAndGenerateDrillAlertsAsync();
    Task CheckAndGenerateCertificateAlertsAsync();
}

public interface IInventoryService
{
    Task<InventoryDto?> GetInventoryByIdAsync(int id);
    Task<PagedResult<InventoryDto>> GetInventoriesAsync(InventoryQueryDto dto);
    Task<InventoryDto> CreateInventoryAsync(InventoryCreateDto dto);
    Task<InventoryDto> UpdateInventoryAsync(int id, InventoryUpdateDto dto);
    Task<bool> DeleteInventoryAsync(int id);
    Task<List<InventoryStatisticsDto>> GetStatisticsAsync(int? enterpriseId = null, int? warehouseId = null, int? category = null);
    Task<InventoryTransactionDto> CreateTransactionAsync(InventoryTransactionCreateDto dto);
    Task<PagedResult<InventoryTransactionDto>> GetTransactionsAsync(InventoryTransactionQueryDto dto);
    Task UpdateInventoryStatusAsync(int inventoryId);
    Task<List<InventoryDto>> GetAlertInventoriesAsync(int? enterpriseId = null);
    Task<WarehouseDto?> GetWarehouseByIdAsync(int id);
    Task<PagedResult<WarehouseDto>> GetWarehousesAsync(int? enterpriseId = null, int pageIndex = 1, int pageSize = 20);
    Task<WarehouseDto> CreateWarehouseAsync(WarehouseCreateDto dto);
    Task<WarehouseDto> UpdateWarehouseAsync(int id, WarehouseUpdateDto dto);
}

public interface ITransportService
{
    Task<TransportRecordDto?> GetTransportByIdAsync(int id);
    Task<PagedResult<TransportRecordDto>> GetTransportsAsync(TransportRecordQueryDto dto);
    Task<TransportRecordDto> CreateTransportAsync(TransportRecordCreateDto dto);
    Task<TransportRecordDto> UpdateTransportAsync(int id, TransportRecordUpdateDto dto);
    Task<TransportMonitoringDto> GetTransportMonitoringAsync(int id);
    Task<TransportTrajectoryDto> UploadTrajectoryAsync(TransportTrajectoryCreateDto dto);
    Task<List<TransportTrajectoryDto>> BatchUploadTrajectoriesAsync(GpsDataUploadDto dto);
    Task<List<TransportTrajectoryDto>> GetTrajectoriesAsync(int transportRecordId, int? limit = 100);
    Task<bool> CheckRouteDeviationAsync(int transportRecordId, decimal longitude, decimal latitude);
    Task<bool> CheckOverspeedingAsync(int transportRecordId, decimal speed);
    Task<bool> CheckTemperatureAbnormalAsync(int transportRecordId, decimal temperature);
    Task UpdateTransportStatusAsync(int transportRecordId);
}

public interface IChemicalBatchService
{
    Task<ChemicalBatchDto?> GetBatchByIdAsync(int id);
    Task<PagedResult<ChemicalBatchDto>> GetBatchesAsync(ChemicalBatchQueryDto dto);
    Task<ChemicalBatchDto> CreateBatchAsync(ChemicalBatchCreateDto dto);
    Task<ChemicalBatchDto> RawMaterialInboundAsync(int batchId, RawMaterialInboundDto dto);
    Task<ChemicalBatchDto> StartProductionAsync(int batchId, ProductionProcessingDto dto);
    Task<ChemicalBatchDto> SubmitInspectionAsync(int batchId, FinishedInspectionDto dto);
    Task<ChemicalBatchDto> OutboundReviewAsync(int batchId, OutboundReviewDto dto);
    Task<BatchLifeCycleDto> GetBatchLifeCycleAsync(int batchId);
    Task<List<ProcessRecordDto>> GetBatchProcessRecordsAsync(int batchId);
    Task<bool> ValidateBatchStatusTransitionAsync(int batchId, BatchStatus targetStatus);
}

public interface IHazardRectificationService
{
    Task<HazardRectificationDto?> GetHazardByIdAsync(int id);
    Task<PagedResult<HazardRectificationDto>> GetHazardsAsync(HazardRectificationQueryDto dto);
    Task<HazardRectificationDto> CreateHazardAsync(HazardRectificationCreateDto dto);
    Task<HazardRectificationDto> StartRectificationAsync(int id, HazardRectificationStartDto dto);
    Task<HazardRectificationDto> CompleteRectificationAsync(int id, HazardRectificationCompleteDto dto);
    Task<HazardRectificationDto> InspectRectificationAsync(int id, HazardRectificationInspectionDto dto);
    Task<HazardRectificationDto> EscalateHazardAsync(int id, string reason);
    Task<HazardStatisticsDto> GetStatisticsAsync(int? enterpriseId = null, int? year = null, int? month = null);
    Task CheckOverdueHazardsAsync();
}

public interface IEmergencyDrillService
{
    Task<EmergencyDrillDto?> GetDrillByIdAsync(int id);
    Task<PagedResult<EmergencyDrillDto>> GetDrillsAsync(EmergencyDrillQueryDto dto);
    Task<EmergencyDrillDto> CreateDrillAsync(EmergencyDrillCreateDto dto);
    Task<EmergencyDrillDto> StartDrillAsync(int id, EmergencyDrillStartDto dto);
    Task<EmergencyDrillDto> CompleteDrillAsync(int id, EmergencyDrillCompleteDto dto);
    Task<EmergencyDrillDto> EvaluateDrillAsync(int id, EmergencyDrillEvaluateDto dto);
    Task<DrillStatisticsDto> GetStatisticsAsync(int year, int? quarter = null, int? enterpriseId = null);
    Task<List<DrillSupervisionDto>> GetOverdueDrillsAsync();
    Task SendSupervisionReminderAsync(int drillId);
    Task CheckDrillExecutionStatusAsync();
}

public interface IReportService
{
    Task<ComplianceReportDto> GetComplianceReportAsync(ReportQueryDto dto);
    Task<byte[]> ExportComplianceReportAsync(ReportQueryDto dto);
    Task<byte[]> ExportInventoryReportAsync(int? enterpriseId = null, int? warehouseId = null, int? category = null);
    Task<byte[]> ExportTransportReportAsync(DateRangeFilter dateRange, int? enterpriseId = null);
    Task<byte[]> ExportHazardReportAsync(int? enterpriseId = null, int? status = null);
    Task<byte[]> ExportDrillReportAsync(int year, int? quarter = null, int? enterpriseId = null);
}

public interface ICertificateService
{
    Task<CertificateDto?> GetCertificateByIdAsync(int id);
    Task<PagedResult<CertificateDto>> GetCertificatesAsync(CertificateQueryDto dto);
    Task<CertificateDto> CreateCertificateAsync(CertificateCreateDto dto);
    Task<CertificateVerificationResultDto> VerifyCertificateAsync(CertificateVerifyDto dto);
    Task<bool> UpdateCertificateStatusAsync(int id);
    Task<List<CertificateDto>> GetExpiringCertificatesAsync(int days = 30);
    Task<List<CertificateDto>> GetExpiredCertificatesAsync();
}

public interface IAuthService
{
    Task<ApiResponse<LoginResponse>> LoginAsync(LoginRequest dto);
    Task<UserInfoDto?> GetUserInfoAsync(int userId);
    Task<bool> ValidateTokenAsync(string token);
    Task<string> GenerateTokenAsync(User user);
}
