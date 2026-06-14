using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class AuditService
{
    private readonly IAuditLogRepository _auditLogRepository;

    public AuditService(IAuditLogRepository auditLogRepository)
    {
        _auditLogRepository = auditLogRepository;
    }

    public async Task<CursorPagedResult<AuditLogDto>> GetPagedAsync(AuditLogQueryRequest request)
    {
        var result = await _auditLogRepository.GetPagedAsync(
            request.ActionType,
            request.Module,
            request.OperatorId,
            request.OperatorName,
            request.EntityType,
            request.EntityId,
            request.StartTime,
            request.EndTime,
            request.Status,
            request.Cursor,
            request.Limit,
            request.SortDesc);

        return new CursorPagedResult<AuditLogDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<long> GetCountAsync(AuditActionType? actionType, string? module, DateTime? startTime, DateTime? endTime)
    {
        return await _auditLogRepository.CountAsync(actionType, module, startTime, endTime);
    }

    public async Task LogAsync(
        AuditActionType actionType,
        string actionName,
        string module,
        string? entityType = null,
        string? entityId = null,
        string? operatorId = null,
        string? operatorName = null,
        UserRole? operatorRole = null,
        string? ipAddress = null,
        string? oldValue = null,
        string? newValue = null,
        string? requestUrl = null,
        string? requestMethod = null,
        bool status = true,
        string? errorMessage = null,
        long durationMs = 0)
    {
        var log = new AuditLog
        {
            TraceId = Guid.NewGuid().ToString("N"),
            ActionType = actionType,
            ActionName = actionName,
            Module = module,
            EntityType = entityType,
            EntityId = entityId,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OperatorRole = operatorRole,
            IpAddress = ipAddress,
            OldValue = oldValue,
            NewValue = newValue,
            RequestUrl = requestUrl,
            RequestMethod = requestMethod,
            Status = status,
            ErrorMessage = errorMessage,
            DurationMs = durationMs,
            Timestamp = DateTime.UtcNow
        };

        await _auditLogRepository.AddAsync(log);
    }

    private static AuditLogDto MapToDto(AuditLog log)
    {
        return new AuditLogDto
        {
            Id = log.Id,
            TraceId = log.TraceId,
            ActionType = log.ActionType,
            ActionTypeText = GetActionTypeText(log.ActionType),
            ActionName = log.ActionName,
            Module = log.Module,
            EntityType = log.EntityType,
            EntityId = log.EntityId,
            OperatorId = log.OperatorId,
            OperatorName = log.OperatorName,
            OperatorRole = log.OperatorRole,
            IpAddress = log.IpAddress,
            OldValue = log.OldValue,
            NewValue = log.NewValue,
            Status = log.Status,
            ErrorMessage = log.ErrorMessage,
            DurationMs = log.DurationMs,
            Timestamp = log.Timestamp
        };
    }

    private static string GetActionTypeText(AuditActionType type)
    {
        return type switch
        {
            AuditActionType.Create => "创建",
            AuditActionType.Update => "更新",
            AuditActionType.Delete => "删除",
            AuditActionType.StatusChange => "状态变更",
            AuditActionType.Login => "登录",
            AuditActionType.Logout => "登出",
            AuditActionType.ConfigChange => "配置变更",
            AuditActionType.ReportGenerate => "报表生成",
            _ => "未知"
        };
    }
}
