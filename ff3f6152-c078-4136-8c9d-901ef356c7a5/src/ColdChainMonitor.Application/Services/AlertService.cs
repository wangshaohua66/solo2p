using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class AlertService
{
    private readonly IAlertRepository _alertRepository;
    private readonly IAlertRuleRepository _alertRuleRepository;
    private readonly ITransportTaskRepository _taskRepository;
    private readonly IDeviceRepository _deviceRepository;
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly AlertRuleEngine _ruleEngine;

    public AlertService(
        IAlertRepository alertRepository,
        IAlertRuleRepository alertRuleRepository,
        ITransportTaskRepository taskRepository,
        IDeviceRepository deviceRepository,
        IAuditLogRepository auditLogRepository,
        AlertRuleEngine ruleEngine)
    {
        _alertRepository = alertRepository;
        _alertRuleRepository = alertRuleRepository;
        _taskRepository = taskRepository;
        _deviceRepository = deviceRepository;
        _auditLogRepository = auditLogRepository;
        _ruleEngine = ruleEngine;
    }

    public async Task<AlertDto?> GetByIdAsync(string id)
    {
        var alert = await _alertRepository.GetByIdAsync(id);
        return alert == null ? null : MapToDto(alert);
    }

    public async Task<AlertDto?> GetByAlertNoAsync(string alertNo)
    {
        var alert = await _alertRepository.GetByAlertNoAsync(alertNo);
        return alert == null ? null : MapToDto(alert);
    }

    public async Task<CursorPagedResult<AlertDto>> GetPagedAsync(AlertQueryRequest request)
    {
        var result = await _alertRepository.GetPagedAsync(
            request.AlertLevel,
            request.AlertType,
            request.IsAcknowledged,
            request.IsResolved,
            request.DeviceId,
            request.TransportTaskId,
            request.StartTime,
            request.EndTime,
            request.Cursor,
            request.Limit,
            request.SortDesc);

        return new CursorPagedResult<AlertDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<AlertDto?> AcknowledgeAsync(string alertId, string userId, string userName, string remark)
    {
        var alert = await _alertRepository.GetByIdAsync(alertId);
        if (alert == null) return null;

        await _alertRepository.AcknowledgeAsync(alertId, userId, userName, remark);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "确认预警",
            Module = "Alert",
            EntityType = "Alert",
            EntityId = alertId,
            OperatorId = userId,
            OperatorName = userName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        alert = await _alertRepository.GetByIdAsync(alertId);
        return alert == null ? null : MapToDto(alert);
    }

    public async Task<AlertDto?> ResolveAsync(string alertId, string userId, string userName, string remark)
    {
        var alert = await _alertRepository.GetByIdAsync(alertId);
        if (alert == null) return null;

        await _alertRepository.ResolveAsync(alertId, userId, userName, remark);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "解除预警",
            Module = "Alert",
            EntityType = "Alert",
            EntityId = alertId,
            OperatorId = userId,
            OperatorName = userName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        alert = await _alertRepository.GetByIdAsync(alertId);
        return alert == null ? null : MapToDto(alert);
    }

    public async Task<int> GetUnacknowledgedCountAsync()
    {
        return await _alertRepository.GetUnacknowledgedCountAsync();
    }

    public async Task<List<AlertRuleDto>> GetRulesAsync()
    {
        var rules = await _alertRuleRepository.GetEnabledRulesAsync();
        return rules.Select(MapRuleToDto).ToList();
    }

    public async Task<AlertRuleDto?> GetRuleByIdAsync(string ruleId)
    {
        var rule = await _alertRuleRepository.GetByIdAsync(ruleId);
        return rule == null ? null : MapRuleToDto(rule);
    }

    public async Task<AlertRuleDto> CreateRuleAsync(CreateAlertRuleRequest request, string operatorId, string operatorName)
    {
        var rule = new AlertRule
        {
            RuleName = request.RuleName,
            RuleCode = request.RuleCode,
            AlertType = request.AlertType,
            AlertLevel = request.AlertLevel,
            MetricType = (MetricType)request.MetricType,
            Operator = (ComparisonOperator)request.Operator,
            Threshold = request.Threshold,
            DurationSeconds = request.DurationSeconds,
            Scope = (RuleScope)request.Scope,
            TargetDeviceIds = request.TargetDeviceIds,
            IsEnabled = true,
            Description = request.Description,
            Priority = request.Priority,
            CreatedBy = operatorId,
            CreatedAt = DateTime.UtcNow,
            UpdatedBy = operatorId,
            UpdatedAt = DateTime.UtcNow
        };

        await _alertRuleRepository.AddAsync(rule);
        await _ruleEngine.RefreshRulesAsync();

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Create,
            ActionName = "创建预警规则",
            Module = "Alert",
            EntityType = "AlertRule",
            EntityId = rule.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapRuleToDto(rule);
    }

    public async Task<AlertRuleDto?> UpdateRuleAsync(string ruleId, UpdateAlertRuleRequest request, string operatorId, string operatorName)
    {
        var rule = await _alertRuleRepository.GetByIdAsync(ruleId);
        if (rule == null) return null;

        var oldValue = System.Text.Json.JsonSerializer.Serialize(rule);

        if (!string.IsNullOrEmpty(request.RuleName))
            rule.RuleName = request.RuleName;
        if (request.AlertLevel.HasValue)
            rule.AlertLevel = request.AlertLevel.Value;
        if (request.Threshold.HasValue)
            rule.Threshold = request.Threshold.Value;
        if (request.DurationSeconds.HasValue)
            rule.DurationSeconds = request.DurationSeconds.Value;
        if (request.IsEnabled.HasValue)
            rule.IsEnabled = request.IsEnabled.Value;
        if (request.Description != null)
            rule.Description = request.Description;
        if (request.Priority.HasValue)
            rule.Priority = request.Priority.Value;

        rule.UpdatedBy = operatorId;
        rule.UpdatedAt = DateTime.UtcNow;

        await _alertRuleRepository.UpdateAsync(ruleId, rule);
        await _ruleEngine.RefreshRulesAsync();

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "更新预警规则",
            Module = "Alert",
            EntityType = "AlertRule",
            EntityId = ruleId,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OldValue = oldValue,
            NewValue = System.Text.Json.JsonSerializer.Serialize(rule),
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapRuleToDto(rule);
    }

    public async Task<bool> DeleteRuleAsync(string ruleId, string operatorId, string operatorName)
    {
        var rule = await _alertRuleRepository.GetByIdAsync(ruleId);
        if (rule == null) return false;

        await _alertRuleRepository.DeleteAsync(ruleId);
        await _ruleEngine.RefreshRulesAsync();

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Delete,
            ActionName = "删除预警规则",
            Module = "Alert",
            EntityType = "AlertRule",
            EntityId = ruleId,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return true;
    }

    public async Task RefreshRulesCacheAsync()
    {
        await _ruleEngine.RefreshRulesAsync();
    }

    public async Task<List<AlertDto>> GetAlertsByTaskIdAsync(string taskId)
    {
        var result = await _alertRepository.GetPagedAsync(
            null, null, null, null, null, taskId, null, null, null, 100);
        return result.Items.Select(MapToDto).ToList();
    }

    public async Task<AlertDto> CreateAlertAsync(Alert alert)
    {
        await _alertRepository.AddAsync(alert);
        return MapToDto(alert);
    }

    private static AlertDto MapToDto(Alert alert)
    {
        return new AlertDto
        {
            Id = alert.Id,
            AlertNo = alert.AlertNo,
            AlertType = alert.AlertType,
            AlertTypeText = GetAlertTypeText(alert.AlertType),
            AlertLevel = alert.AlertLevel,
            AlertLevelText = GetAlertLevelText(alert.AlertLevel),
            DeviceId = alert.DeviceId,
            DeviceName = alert.DeviceName,
            TransportTaskId = alert.TransportTaskId,
            TaskNo = alert.TaskNo,
            Value = alert.Value,
            Threshold = alert.Threshold,
            DurationSeconds = alert.DurationSeconds,
            Latitude = alert.Location?.Latitude,
            Longitude = alert.Location?.Longitude,
            Message = alert.Message,
            IsAcknowledged = alert.IsAcknowledged,
            AcknowledgedBy = alert.AcknowledgedBy,
            AcknowledgedByName = alert.AcknowledgedByName,
            AcknowledgedAt = alert.AcknowledgedAt,
            IsResolved = alert.IsResolved,
            ResolvedBy = alert.ResolvedBy,
            ResolvedByName = alert.ResolvedByName,
            ResolvedAt = alert.ResolvedAt,
            FirstTriggeredAt = alert.FirstTriggeredAt,
            LastTriggeredAt = alert.LastTriggeredAt,
            TriggerCount = alert.TriggerCount,
            CreatedAt = alert.CreatedAt
        };
    }

    private static AlertRuleDto MapRuleToDto(AlertRule rule)
    {
        return new AlertRuleDto
        {
            Id = rule.Id,
            RuleName = rule.RuleName,
            RuleCode = rule.RuleCode,
            AlertType = rule.AlertType,
            AlertLevel = rule.AlertLevel,
            MetricType = rule.MetricType,
            Operator = rule.Operator,
            Threshold = rule.Threshold,
            DurationSeconds = rule.DurationSeconds,
            Scope = rule.Scope,
            IsEnabled = rule.IsEnabled,
            Description = rule.Description,
            Priority = rule.Priority,
            CreatedAt = rule.CreatedAt,
            UpdatedAt = rule.UpdatedAt
        };
    }

    private static string GetAlertTypeText(AlertType type)
    {
        return type switch
        {
            AlertType.TemperatureHigh => "温度过高",
            AlertType.TemperatureLow => "温度过低",
            AlertType.HumidityHigh => "湿度过高",
            AlertType.HumidityLow => "湿度过低",
            AlertType.DeviceOffline => "设备离线",
            AlertType.DeviceLowBattery => "设备低电量",
            AlertType.DurationExceeded => "超时异常",
            _ => "未知"
        };
    }

    private static string GetAlertLevelText(AlertLevel level)
    {
        return level switch
        {
            AlertLevel.Info => "提示",
            AlertLevel.Warning => "警告",
            AlertLevel.Critical => "严重",
            AlertLevel.Fatal => "致命",
            _ => "未知"
        };
    }
}
