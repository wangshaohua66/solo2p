using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IAuditLogRepository
{
    Task AddAsync(AuditLog log);
    Task AddBatchAsync(List<AuditLog> logs);
    Task<CursorPagedResult<AuditLog>> GetPagedAsync(
        AuditActionType? actionType,
        string? module,
        string? operatorId,
        string? operatorName,
        string? entityType,
        string? entityId,
        DateTime? startTime,
        DateTime? endTime,
        bool? status,
        string? cursor,
        int limit,
        bool sortDesc = true);
    Task<long> CountAsync(
        AuditActionType? actionType,
        string? module,
        DateTime? startTime,
        DateTime? endTime);
}
