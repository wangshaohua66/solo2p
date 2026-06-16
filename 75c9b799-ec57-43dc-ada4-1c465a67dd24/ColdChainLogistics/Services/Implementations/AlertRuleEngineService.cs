using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class AlertRuleEngineService : IAlertRuleEngineService
{
    private readonly IAlertRuleRepository _alertRuleRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly INotificationService _notificationService;
    private readonly ISensorRepository _sensorRepository;

    public AlertRuleEngineService(
        IAlertRuleRepository alertRuleRepository,
        IAlertRepository alertRepository,
        INotificationService notificationService,
        ISensorRepository sensorRepository)
    {
        _alertRuleRepository = alertRuleRepository;
        _alertRepository = alertRepository;
        _notificationService = notificationService;
        _sensorRepository = sensorRepository;
    }

    public async Task<List<AlertRule>> GetApplicableRulesAsync(long? customerId = null, long? vehicleId = null)
    {
        var allRules = await _alertRuleRepository.GetRulesWithConditionsAsync(customerId);
        return allRules;
    }

    public async Task<List<Alert>> EvaluateRulesAsync(long sensorId, SensorData latestData, SlidingWindowStatsDto stats)
    {
        var triggeredAlerts = new List<Alert>();
        var sensor = await _sensorRepository.GetByIdAsync(sensorId);
        if (sensor == null) return triggeredAlerts;

        long? customerId = null;
        long? vehicleId = sensor.VehicleId;
        long? shipmentId = latestData.ShipmentId;

        var rules = await _alertRuleRepository.GetRulesWithConditionsAsync(null);

        var applicableRules = rules
            .Where(r => r.IsEnabled && r.Conditions.Count > 0)
            .OrderBy(r => r.Priority)
            .ToList();

        foreach (var rule in applicableRules)
        {
            var isTriggered = await EvaluateRuleAsync(rule, sensorId, latestData, stats);
            if (isTriggered)
            {
                var alert = await HandleTriggeredRuleAsync(rule, sensor, latestData, stats, vehicleId, customerId, shipmentId);
                if (alert != null)
                {
                    triggeredAlerts.Add(alert);
                }
            }
        }

        return triggeredAlerts;
    }

    public async Task<bool> EvaluateRuleAsync(AlertRule rule, long sensorId, SensorData latestData, SlidingWindowStatsDto stats)
    {
        if (rule.Conditions == null || rule.Conditions.Count == 0)
            return false;

        var conditionGroups = rule.Conditions
            .GroupBy(c => c.ConditionGroup)
            .OrderBy(g => g.Key)
            .ToList();

        var groupResults = new List<bool>();

        foreach (var group in conditionGroups)
        {
            var groupConditions = group.ToList();
            var groupOperator = group.First().GroupOperator;

            bool groupResult;
            if (groupOperator == RuleLogicalOperator.And)
            {
                groupResult = true;
                foreach (var condition in groupConditions)
                {
                    var conditionResult = await EvaluateConditionAsync(condition, latestData, stats);
                    groupResult &= conditionResult;
                    if (!groupResult) break;
                }
            }
            else
            {
                groupResult = false;
                foreach (var condition in groupConditions)
                {
                    var conditionResult = await EvaluateConditionAsync(condition, latestData, stats);
                    groupResult |= conditionResult;
                    if (groupResult) break;
                }
            }

            groupResults.Add(groupResult);
        }

        bool finalResult;
        if (rule.LogicalOperator == RuleLogicalOperator.And)
        {
            finalResult = groupResults.All(r => r);
        }
        else
        {
            finalResult = groupResults.Any(r => r);
        }

        if (finalResult && rule.DurationSeconds > 0)
        {
            finalResult = await CheckSustainedConditionAsync(sensorId, rule, latestData.Timestamp, rule.DurationSeconds);
        }

        return finalResult;
    }

    public async Task<bool> EvaluateConditionAsync(AlertRuleCondition condition, SensorData latestData, SlidingWindowStatsDto stats)
    {
        var metricValue = GetMetricValue(condition.Metric, latestData, stats);
        if (!metricValue.HasValue)
            return false;

        return EvaluateOperator(condition.Operator, metricValue.Value, condition.ThresholdValue, condition.ThresholdValue2);
    }

    private double? GetMetricValue(string metric, SensorData latestData, SlidingWindowStatsDto stats)
    {
        return metric.ToLower() switch
        {
            "temperature" => latestData.Temperature,
            "humidity" => latestData.Humidity,
            "avg_temperature" => stats?.AvgTemperature,
            "avg_humidity" => stats?.AvgHumidity,
            "max_temperature" => stats?.MaxTemperature,
            "min_temperature" => stats?.MinTemperature,
            "max_humidity" => stats?.MaxHumidity,
            "min_humidity" => stats?.MinHumidity,
            "temperature_volatility" => stats?.TemperatureVolatility,
            "humidity_volatility" => stats?.HumidityVolatility,
            "temperature_variance" => stats?.TemperatureVariance,
            "humidity_variance" => stats?.HumidityVariance,
            "temperature_change_rate" => stats?.TemperatureVolatility,
            _ => null
        };
    }

    private bool EvaluateOperator(RuleConditionOperator op, double value, double threshold, double? threshold2)
    {
        return op switch
        {
            RuleConditionOperator.GreaterThan => value > threshold,
            RuleConditionOperator.LessThan => value < threshold,
            RuleConditionOperator.GreaterThanOrEqual => value >= threshold,
            RuleConditionOperator.LessThanOrEqual => value <= threshold,
            RuleConditionOperator.Equal => Math.Abs(value - threshold) < 0.001,
            RuleConditionOperator.NotEqual => Math.Abs(value - threshold) >= 0.001,
            RuleConditionOperator.Between => threshold2.HasValue && value >= threshold && value <= threshold2.Value,
            RuleConditionOperator.Outside => threshold2.HasValue && (value < threshold || value > threshold2.Value),
            _ => false
        };
    }

    private Task<bool> CheckSustainedConditionAsync(long sensorId, AlertRule rule, DateTime currentTime, int durationSeconds)
    {
        return Task.FromResult(true);
    }

    private async Task<Alert?> HandleTriggeredRuleAsync(AlertRule rule, Sensor sensor, SensorData latestData,
        SlidingWindowStatsDto stats, long? vehicleId, long? customerId, long? shipmentId)
    {
        var existingAlert = await _alertRepository.GetActiveAlertByRuleAndSensorAsync(rule.Id, sensor.Id);

        if (existingAlert != null)
        {
            existingAlert.LastTriggeredAt = DateTime.UtcNow;
            existingAlert.TriggerCount++;
            existingAlert.TriggerValue = latestData.Temperature;
            _alertRepository.Update(existingAlert);
            await _alertRepository.SaveChangesAsync();
            return existingAlert;
        }

        var alertCode = GenerateAlertCode();
        var alert = new Alert
        {
            AlertCode = alertCode,
            AlertRuleId = rule.Id,
            CustomerId = customerId,
            VehicleId = vehicleId,
            SensorId = sensor.Id,
            ShipmentId = shipmentId,
            Severity = rule.Severity,
            Status = AlertStatus.New,
            Title = $"{rule.RuleName} - {sensor.SensorCode}",
            Description = GenerateAlertDescription(rule, sensor, latestData, stats),
            FirstTriggeredAt = DateTime.UtcNow,
            LastTriggeredAt = DateTime.UtcNow,
            TriggerCount = 1,
            TriggerValue = latestData.Temperature,
            TriggerMetric = GetFirstConditionMetric(rule),
            EscalationLevel = 1,
            NextEscalationAt = DateTime.UtcNow.AddMinutes(30),
            IsEscalated = false
        };

        await _alertRepository.AddAsync(alert);
        await _alertRepository.SaveChangesAsync();

        Log.Information("告警触发: {AlertCode} - 规则: {RuleName} - 传感器: {SensorCode} - 当前值: {Value}",
            alertCode, rule.RuleName, sensor.SensorCode, latestData.Temperature);

        _ = Task.Run(() => _notificationService.SendAlertNotificationAsync(alert));

        return alert;
    }

    private string GenerateAlertCode()
    {
        return $"ALT{DateTime.UtcNow:yyyyMMddHHmmssfff}{new Random().Next(1000, 9999)}";
    }

    private string GenerateAlertDescription(AlertRule rule, Sensor sensor, SensorData latestData, SlidingWindowStatsDto stats)
    {
        var firstCondition = rule.Conditions.FirstOrDefault();
        var metric = firstCondition?.Metric ?? "temperature";
        var value = metric.ToLower().Contains("humidity") ? $"{latestData.Humidity:F1}%" : $"{latestData.Temperature:F2}°C";
        return $"{sensor.SensorCode} 触发规则 [{rule.RuleName}]，当前 {metric}: {value}";
    }

    private string? GetFirstConditionMetric(AlertRule rule)
    {
        return rule.Conditions.FirstOrDefault()?.Metric;
    }
}
