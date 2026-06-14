using ColdChainMonitor.Domain.Models;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IAlertRuleRepository : IRepository<AlertRule>
{
    Task<List<AlertRule>> GetEnabledRulesAsync();
    Task<AlertRule?> GetByRuleCodeAsync(string ruleCode);
    Task<List<AlertRule>> GetByMetricTypeAsync(Domain.Models.MetricType metricType);
    Task BulkUpdateCacheAsync();
}
