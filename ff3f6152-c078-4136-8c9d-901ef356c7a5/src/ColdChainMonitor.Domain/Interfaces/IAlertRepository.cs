using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IAlertRepository : IRepository<Alert>
{
    Task<Alert?> GetByAlertNoAsync(string alertNo);
    Task<CursorPagedResult<Alert>> GetPagedAsync(
        AlertLevel? alertLevel,
        AlertType? alertType,
        bool? isAcknowledged,
        bool? isResolved,
        string? deviceId,
        string? transportTaskId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true);
    Task<Alert?> GetActiveAlertByDeviceAndTypeAsync(string deviceId, AlertType alertType);
    Task IncrementAlertTriggerAsync(string alertId, DateTime lastTriggeredAt);
    Task AcknowledgeAsync(string alertId, string userId, string userName, string remark);
    Task ResolveAsync(string alertId, string userId, string userName, string remark);
    Task<int> GetUnacknowledgedCountAsync();
    Task<List<AlertTypeCount>> GetAlertTypeStatsAsync(DateTime startTime, DateTime endTime);
}
