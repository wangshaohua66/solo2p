using System.Collections.Concurrent;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Domain.Interfaces;

namespace ColdChainMonitor.Application.Services;

public class AlertRuleEngine
{
    private readonly IAlertRuleRepository _alertRuleRepository;
    private readonly ConcurrentDictionary<string, AlertRule> _ruleCache;
    private readonly ConcurrentDictionary<string, DeviceAnomalyState> _deviceAnomalyStates;
    private DateTime _lastCacheRefresh;
    private readonly TimeSpan _cacheRefreshInterval = TimeSpan.FromMinutes(1);
    private readonly object _cacheLock = new();

    public AlertRuleEngine(IAlertRuleRepository alertRuleRepository)
    {
        _alertRuleRepository = alertRuleRepository;
        _ruleCache = new ConcurrentDictionary<string, AlertRule>();
        _deviceAnomalyStates = new ConcurrentDictionary<string, DeviceAnomalyState>();
        _lastCacheRefresh = DateTime.MinValue;
    }

    public async Task RefreshRulesAsync()
    {
        var rules = await _alertRuleRepository.GetEnabledRulesAsync();
        _ruleCache.Clear();
        foreach (var rule in rules.OrderBy(r => r.Priority))
        {
            _ruleCache.TryAdd(rule.Id, rule);
        }
        _lastCacheRefresh = DateTime.UtcNow;
    }

    private async Task EnsureRulesFreshAsync()
    {
        if (DateTime.UtcNow - _lastCacheRefresh > _cacheRefreshInterval)
        {
            await RefreshRulesAsync();
        }
    }

    public async Task<List<AlertMatchResult>> EvaluateTemperatureAsync(
        string deviceId,
        double temperature,
        double? humidity,
        DateTime timestamp,
        string? transportTaskId = null)
    {
        await EnsureRulesFreshAsync();

        var results = new List<AlertMatchResult>();
        var applicableRules = _ruleCache.Values
            .Where(r => r.MetricType == MetricType.Temperature || r.MetricType == MetricType.Humidity)
            .OrderBy(r => r.Priority)
            .ToList();

        foreach (var rule in applicableRules)
        {
            if (!IsRuleApplicable(rule, deviceId))
                continue;

            double? value = rule.MetricType switch
            {
                MetricType.Temperature => temperature,
                MetricType.Humidity => humidity,
                _ => null
            };

            if (!value.HasValue)
                continue;

            var isMatch = EvaluateComparison(value.Value, rule.Operator, rule.Threshold);
            var stateKey = $"{deviceId}_{rule.Id}";

            if (isMatch)
            {
                var state = _deviceAnomalyStates.GetOrAdd(stateKey, _ => new DeviceAnomalyState
                {
                    DeviceId = deviceId,
                    RuleId = rule.Id,
                    FirstDetectedAt = timestamp,
                    LastDetectedAt = timestamp,
                    CurrentValue = value.Value
                });

                state.LastDetectedAt = timestamp;
                state.CurrentValue = value.Value;

                var duration = timestamp - state.FirstDetectedAt;
                if (duration.TotalSeconds >= rule.DurationSeconds)
                {
                    if (!state.AlertTriggered || rule.AlertType == AlertType.DurationExceeded)
                    {
                        state.AlertTriggered = true;
                        results.Add(new AlertMatchResult
                        {
                            Rule = rule,
                            DeviceId = deviceId,
                            Value = value.Value,
                            DurationSeconds = (int)duration.TotalSeconds,
                            FirstDetectedAt = state.FirstDetectedAt,
                            IsNewAlert = !state.HasNotified,
                            TransportTaskId = transportTaskId
                        });
                        state.HasNotified = true;
                    }
                }
            }
            else
            {
                if (_deviceAnomalyStates.TryRemove(stateKey, out _))
                {
                    // anomaly cleared - could trigger a resolution event
                }
            }
        }

        return results;
    }

    public async Task<List<AlertMatchResult>> EvaluateDeviceStatusAsync(
        string deviceId,
        DeviceStatus status,
        double batteryLevel,
        DateTime lastReportTime,
        DateTime currentTime,
        int offlineThresholdMinutes,
        double lowBatteryThreshold)
    {
        await EnsureRulesFreshAsync();

        var results = new List<AlertMatchResult>();

        var offlineDuration = currentTime - lastReportTime;
        if (offlineDuration.TotalMinutes >= offlineThresholdMinutes && status != DeviceStatus.Inactive)
        {
            var offlineRule = _ruleCache.Values.FirstOrDefault(r => r.AlertType == AlertType.DeviceOffline);
            if (offlineRule != null && IsRuleApplicable(offlineRule, deviceId))
            {
                var stateKey = $"{deviceId}_offline";
                var state = _deviceAnomalyStates.GetOrAdd(stateKey, _ => new DeviceAnomalyState
                {
                    DeviceId = deviceId,
                    RuleId = offlineRule.Id,
                    FirstDetectedAt = currentTime,
                    LastDetectedAt = currentTime
                });

                if (!state.HasNotified)
                {
                    state.HasNotified = true;
                    results.Add(new AlertMatchResult
                    {
                        Rule = offlineRule,
                        DeviceId = deviceId,
                        Value = offlineDuration.TotalMinutes,
                        DurationSeconds = (int)offlineDuration.TotalSeconds,
                        FirstDetectedAt = lastReportTime,
                        IsNewAlert = true
                    });
                }
            }
        }

        if (batteryLevel <= lowBatteryThreshold && status != DeviceStatus.Inactive)
        {
            var batteryRule = _ruleCache.Values.FirstOrDefault(r => r.AlertType == AlertType.DeviceLowBattery);
            if (batteryRule != null && IsRuleApplicable(batteryRule, deviceId))
            {
                var stateKey = $"{deviceId}_lowbattery";
                var state = _deviceAnomalyStates.GetOrAdd(stateKey, _ => new DeviceAnomalyState
                {
                    DeviceId = deviceId,
                    RuleId = batteryRule.Id,
                    FirstDetectedAt = currentTime,
                    LastDetectedAt = currentTime
                });

                if (!state.HasNotified)
                {
                    state.HasNotified = true;
                    results.Add(new AlertMatchResult
                    {
                        Rule = batteryRule,
                        DeviceId = deviceId,
                        Value = batteryLevel,
                        IsNewAlert = true
                    });
                }
            }
        }

        return results;
    }

    private bool IsRuleApplicable(AlertRule rule, string deviceId)
    {
        if (rule.Scope == RuleScope.Global)
            return true;

        if (rule.Scope == RuleScope.SpecificDevices && rule.TargetDeviceIds != null)
            return rule.TargetDeviceIds.Contains(deviceId);

        return true;
    }

    private bool EvaluateComparison(double value, ComparisonOperator op, double threshold)
    {
        return op switch
        {
            ComparisonOperator.GreaterThan => value > threshold,
            ComparisonOperator.LessThan => value < threshold,
            ComparisonOperator.GreaterThanOrEqual => value >= threshold,
            ComparisonOperator.LessThanOrEqual => value <= threshold,
            ComparisonOperator.Equal => Math.Abs(value - threshold) < 0.001,
            ComparisonOperator.NotEqual => Math.Abs(value - threshold) >= 0.001,
            _ => false
        };
    }

    public void ClearDeviceState(string deviceId)
    {
        var keysToRemove = _deviceAnomalyStates.Keys
            .Where(k => k.StartsWith(deviceId + "_"))
            .ToList();
        foreach (var key in keysToRemove)
        {
            _deviceAnomalyStates.TryRemove(key, out _);
        }
    }

    public void ClearAllStates()
    {
        _deviceAnomalyStates.Clear();
    }

    public int GetCachedRuleCount()
    {
        return _ruleCache.Count;
    }

    public List<AlertRule> GetCachedRules()
    {
        return _ruleCache.Values.OrderBy(r => r.Priority).ToList();
    }
}

public class AlertMatchResult
{
    public AlertRule Rule { get; set; } = null!;
    public string DeviceId { get; set; } = string.Empty;
    public double Value { get; set; }
    public int? DurationSeconds { get; set; }
    public DateTime FirstDetectedAt { get; set; }
    public bool IsNewAlert { get; set; }
    public string? TransportTaskId { get; set; }
}

public class DeviceAnomalyState
{
    public string DeviceId { get; set; } = string.Empty;
    public string RuleId { get; set; } = string.Empty;
    public DateTime FirstDetectedAt { get; set; }
    public DateTime LastDetectedAt { get; set; }
    public double CurrentValue { get; set; }
    public bool AlertTriggered { get; set; }
    public bool HasNotified { get; set; }
}
