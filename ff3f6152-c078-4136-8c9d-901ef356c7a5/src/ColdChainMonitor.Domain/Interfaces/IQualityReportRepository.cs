using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IQualityReportRepository : IRepository<QualityReport>
{
    Task<QualityReport?> GetByReportNoAsync(string reportNo);
    Task<QualityReport?> GetByTransportTaskIdAsync(string transportTaskId);
    Task<CursorPagedResult<QualityReport>> GetPagedAsync(
        QualityResult? result,
        string? keyword,
        string? taskNo,
        string? inspectorId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true);
}
