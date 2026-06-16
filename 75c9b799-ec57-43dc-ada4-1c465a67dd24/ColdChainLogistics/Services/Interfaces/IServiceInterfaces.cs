using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Models.Entities;

namespace ColdChainLogistics.Services.Interfaces;

public interface ISensorDataService
{
    Task<SensorDataBatchResponse> ReceiveBatchAsync(SensorDataBatchRequest request);
    Task<PagedResult<SensorDataDto>> GetPagedAsync(SensorDataQueryRequest request);
    Task<SlidingWindowStatsDto?> GetSlidingWindowStatsAsync(long sensorId, int windowMinutes = 5);
    Task<List<SensorDataDto>> GetByShipmentIdAsync(long shipmentId, DateTime startTime, DateTime endTime);
}

public interface IAlertRuleEngineService
{
    Task<List<Alert>> EvaluateRulesAsync(long sensorId, SensorData latestData, SlidingWindowStatsDto stats);
    Task<bool> EvaluateRuleAsync(AlertRule rule, long sensorId, SensorData latestData, SlidingWindowStatsDto stats);
    Task<bool> EvaluateConditionAsync(AlertRuleCondition condition, SensorData latestData, SlidingWindowStatsDto stats);
    Task<List<AlertRule>> GetApplicableRulesAsync(long? customerId = null, long? vehicleId = null);
}

public interface ITraceabilityService
{
    Task<TraceabilityResponse> GetTraceabilityAsync(TraceabilityQueryRequest request);
    Task BuildTraceabilityChainAsync(long shipmentId);
    Task AddTraceabilityNodeAsync(long shipmentId, string nodeType, string nodeName,
        DateTime timestamp, double? temperature = null, double? humidity = null,
        string? location = null, string? operatorName = null, string? remark = null);
}

public interface IReportService
{
    Task<ReportDto> GenerateReportAsync(ReportGenerateRequest request);
    Task<PagedResult<ReportDto>> GetPagedAsync(ReportQueryRequest request);
    Task<ReportDto?> GetByIdAsync(long id);
    Task GenerateMonthlyReportsAsync();
    Task<byte[]> DownloadReportAsync(long reportId);
}

public interface INotificationService
{
    Task SendAlertNotificationAsync(Alert alert);
    Task ProcessEscalationAsync();
    Task RetryFailedNotificationsAsync();
}

public interface IDeviceHealthMonitorService
{
    Task CheckDeviceHealthAsync();
    Task MarkSensorOfflineAsync(long sensorId);
    Task<bool> IsInMaintenanceWindowAsync(long sensorId, DateTime time);
}

public interface IShipmentService
{
    Task<ShipmentDto> CreateAsync(ShipmentCreateRequest request);
    Task<ShipmentDto?> UpdateAsync(ShipmentUpdateRequest request);
    Task<ShipmentDto?> UpdateStatusAsync(ShipmentStatusUpdateRequest request);
    Task<ShipmentDto?> GetByIdAsync(long id);
    Task<PagedResult<ShipmentDto>> GetPagedAsync(ShipmentQueryRequest request);
}

public interface IAlertRuleService
{
    Task<AlertRuleDto> CreateAsync(AlertRuleCreateRequest request, string operatorName, string? ipAddress = null);
    Task<AlertRuleDto?> UpdateAsync(AlertRuleUpdateRequest request, string operatorName, string? ipAddress = null);
    Task<bool> DeleteAsync(long id, string operatorName, string? ipAddress = null);
    Task<AlertRuleDto?> GetByIdAsync(long id);
    Task<PagedResult<AlertRuleDto>> GetPagedAsync(AlertRuleQueryRequest request);
}

public interface IAlertService
{
    Task<PagedResult<AlertDto>> GetPagedAsync(AlertQueryRequest request);
    Task<AlertDto?> GetByIdAsync(long id);
    Task<AlertDto?> AcknowledgeAsync(AlertAcknowledgeRequest request, string operatorName);
    Task<AlertDto?> ResolveAsync(AlertResolveRequest request, string operatorName);
}
