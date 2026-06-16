using Newtonsoft.Json;
using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class AlertRuleService : IAlertRuleService
{
    private readonly IAlertRuleRepository _alertRuleRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IAlertRuleAuditLogRepository _auditLogRepository;

    public AlertRuleService(
        IAlertRuleRepository alertRuleRepository,
        ICustomerRepository customerRepository,
        IAlertRuleAuditLogRepository auditLogRepository)
    {
        _alertRuleRepository = alertRuleRepository;
        _customerRepository = customerRepository;
        _auditLogRepository = auditLogRepository;
    }

    public async Task<AlertRuleDto> CreateAsync(AlertRuleCreateRequest request, string operatorName, string? ipAddress = null)
    {
        if (request.CustomerId.HasValue)
        {
            var customer = await _customerRepository.GetByIdAsync(request.CustomerId.Value);
            if (customer == null)
                throw new KeyNotFoundException($"客户 {request.CustomerId} 不存在");
        }

        var rule = new AlertRule
        {
            RuleName = request.RuleName,
            CustomerId = request.CustomerId,
            Description = request.Description,
            IsEnabled = true,
            Severity = (AlertSeverity)request.Severity,
            LogicalOperator = (RuleLogicalOperator)request.LogicalOperator,
            DurationSeconds = request.DurationSeconds,
            DetectionMode = (DetectionMode)request.DetectionMode,
            WindowSizeMinutes = request.WindowSizeMinutes,
            AutoCalibrateBaseline = request.AutoCalibrateBaseline,
            Priority = request.Priority,
            CreatedBy = operatorName,
            UpdatedBy = operatorName,
            Conditions = request.Conditions.Select(c => new AlertRuleCondition
            {
                ConditionGroup = c.ConditionGroup,
                GroupOperator = (RuleLogicalOperator)c.GroupOperator,
                Metric = c.Metric,
                Operator = (RuleConditionOperator)c.Operator,
                ThresholdValue = c.ThresholdValue,
                ThresholdValue2 = c.ThresholdValue2,
                Unit = c.Unit
            }).ToList()
        };

        await _alertRuleRepository.AddAsync(rule);
        await _alertRuleRepository.SaveChangesAsync();

        await AddAuditLogAsync(rule.Id, "Create", null, JsonConvert.SerializeObject(rule), operatorName, ipAddress);

        Log.Information("告警规则创建成功: RuleId={RuleId}, RuleName={RuleName}, Operator={Operator}",
            rule.Id, rule.RuleName, operatorName);

        return await MapToDto(rule);
    }

    public async Task<AlertRuleDto?> UpdateAsync(AlertRuleUpdateRequest request, string operatorName, string? ipAddress = null)
    {
        var rule = await _alertRuleRepository.GetWithConditionsAsync(request.Id);
        if (rule == null)
            return null;

        var oldValue = JsonConvert.SerializeObject(rule);

        rule.RuleName = request.RuleName;
        rule.Description = request.Description;
        rule.IsEnabled = request.IsEnabled;
        rule.Severity = (AlertSeverity)request.Severity;
        rule.LogicalOperator = (RuleLogicalOperator)request.LogicalOperator;
        rule.DurationSeconds = request.DurationSeconds;
        rule.DetectionMode = (DetectionMode)request.DetectionMode;
        rule.WindowSizeMinutes = request.WindowSizeMinutes;
        rule.AutoCalibrateBaseline = request.AutoCalibrateBaseline;
        rule.Priority = request.Priority;
        rule.UpdatedBy = operatorName;
        rule.UpdatedAt = DateTime.UtcNow;

        if (request.Conditions != null)
        {
            var existingConditions = rule.Conditions.ToList();
            foreach (var condition in existingConditions)
            {
                condition.IsDeleted = true;
            }

            foreach (var c in request.Conditions)
            {
                if (c.Id.HasValue && c.Id.Value > 0)
                {
                    var existing = existingConditions.FirstOrDefault(ec => ec.Id == c.Id.Value);
                    if (existing != null)
                    {
                        existing.IsDeleted = false;
                        existing.ConditionGroup = c.ConditionGroup;
                        existing.GroupOperator = (RuleLogicalOperator)c.GroupOperator;
                        existing.Metric = c.Metric;
                        existing.Operator = (RuleConditionOperator)c.Operator;
                        existing.ThresholdValue = c.ThresholdValue;
                        existing.ThresholdValue2 = c.ThresholdValue2;
                        existing.Unit = c.Unit;
                        continue;
                    }
                }

                rule.Conditions.Add(new AlertRuleCondition
                {
                    ConditionGroup = c.ConditionGroup,
                    GroupOperator = (RuleLogicalOperator)c.GroupOperator,
                    Metric = c.Metric,
                    Operator = (RuleConditionOperator)c.Operator,
                    ThresholdValue = c.ThresholdValue,
                    ThresholdValue2 = c.ThresholdValue2,
                    Unit = c.Unit
                });
            }
        }

        _alertRuleRepository.Update(rule);
        await _alertRuleRepository.SaveChangesAsync();

        var newValue = JsonConvert.SerializeObject(rule);
        await AddAuditLogAsync(rule.Id, "Update", oldValue, newValue, operatorName, ipAddress);

        Log.Information("告警规则更新成功: RuleId={RuleId}, RuleName={RuleName}, Operator={Operator}",
            rule.Id, rule.RuleName, operatorName);

        return await MapToDto(rule);
    }

    public async Task<bool> DeleteAsync(long id, string operatorName, string? ipAddress = null)
    {
        var rule = await _alertRuleRepository.GetByIdAsync(id);
        if (rule == null)
            return false;

        var oldValue = JsonConvert.SerializeObject(rule);

        rule.IsDeleted = true;
        rule.UpdatedAt = DateTime.UtcNow;
        rule.UpdatedBy = operatorName;

        _alertRuleRepository.Update(rule);
        await _alertRuleRepository.SaveChangesAsync();

        await AddAuditLogAsync(id, "Delete", oldValue, null, operatorName, ipAddress);

        Log.Information("告警规则删除成功: RuleId={RuleId}, Operator={Operator}", id, operatorName);

        return true;
    }

    public async Task<AlertRuleDto?> GetByIdAsync(long id)
    {
        var rule = await _alertRuleRepository.GetWithConditionsAsync(id);
        return rule != null ? await MapToDto(rule) : null;
    }

    public async Task<PagedResult<AlertRuleDto>> GetPagedAsync(AlertRuleQueryRequest request)
    {
        var (items, totalCount) = await _alertRuleRepository.GetPagedAsync(
            request.PageIndex,
            request.PageSize,
            r => (!request.CustomerId.HasValue || r.CustomerId == request.CustomerId.Value)
              && (string.IsNullOrWhiteSpace(request.RuleName) || r.RuleName.Contains(request.RuleName))
              && (!request.Severity.HasValue || (int)r.Severity == request.Severity.Value)
              && (!request.IsEnabled.HasValue || r.IsEnabled == request.IsEnabled.Value),
            r => r.CreatedAt,
            true);

        var dtoList = new List<AlertRuleDto>();
        foreach (var item in items)
        {
            dtoList.Add(await MapToDto(item));
        }

        return new PagedResult<AlertRuleDto>
        {
            PageIndex = request.PageIndex,
            PageSize = request.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling((double)totalCount / request.PageSize),
            Items = dtoList
        };
    }

    private async Task AddAuditLogAsync(long ruleId, string action, string? oldValue, string? newValue, string operatorName, string? ipAddress)
    {
        var auditLog = new AlertRuleAuditLog
        {
            AlertRuleId = ruleId,
            Action = action,
            OldValue = oldValue,
            NewValue = newValue,
            Operator = operatorName,
            IpAddress = ipAddress
        };

        await _auditLogRepository.AddAuditLogAsync(auditLog);
    }

    private async Task<AlertRuleDto> MapToDto(AlertRule rule)
    {
        var customer = rule.CustomerId.HasValue
            ? await _customerRepository.GetByIdAsync(rule.CustomerId.Value)
            : null;

        var conditions = rule.Conditions?
            .Where(c => !c.IsDeleted)
            .Select(c => new AlertRuleConditionDto
            {
                Id = c.Id,
                ConditionGroup = c.ConditionGroup,
                GroupOperator = (int)c.GroupOperator,
                Metric = c.Metric,
                Operator = (int)c.Operator,
                ThresholdValue = c.ThresholdValue,
                ThresholdValue2 = c.ThresholdValue2,
                Unit = c.Unit
            }).ToList() ?? new List<AlertRuleConditionDto>();

        return new AlertRuleDto
        {
            Id = rule.Id,
            RuleName = rule.RuleName,
            CustomerId = rule.CustomerId,
            CustomerName = customer?.Name,
            Description = rule.Description,
            IsEnabled = rule.IsEnabled,
            Severity = (int)rule.Severity,
            SeverityText = rule.Severity.ToString(),
            LogicalOperator = (int)rule.LogicalOperator,
            DurationSeconds = rule.DurationSeconds,
            DetectionMode = (int)rule.DetectionMode,
            WindowSizeMinutes = rule.WindowSizeMinutes,
            BaselineTemperature = rule.BaselineTemperature,
            BaselineHumidity = rule.BaselineHumidity,
            AutoCalibrateBaseline = rule.AutoCalibrateBaseline,
            Priority = rule.Priority,
            CreatedAt = rule.CreatedAt,
            UpdatedAt = rule.UpdatedAt,
            Conditions = conditions
        };
    }
}
