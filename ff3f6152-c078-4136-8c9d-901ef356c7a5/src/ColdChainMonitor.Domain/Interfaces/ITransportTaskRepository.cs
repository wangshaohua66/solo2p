using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Interfaces;

public interface ITransportTaskRepository : IRepository<TransportTask>
{
    Task<TransportTask?> GetByTaskNoAsync(string taskNo);
    Task<CursorPagedResult<TransportTask>> GetPagedAsync(
        TransportStatus? status,
        string? keyword,
        string? vehicleId,
        string? driverId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true);
    Task UpdateStatusAsync(string id, TransportStatus status, StatusChangeRecord statusRecord);
    Task<List<TransportTask>> GetActiveTasksByDeviceIdAsync(string deviceId);
    Task UpdateAlertCountAsync(string taskId, int alertCount, int criticalAlertCount);
    Task SetLoadingRecordAsync(string taskId, LoadingRecord record);
    Task SetUnloadingRecordAsync(string taskId, LoadingRecord record);
}
