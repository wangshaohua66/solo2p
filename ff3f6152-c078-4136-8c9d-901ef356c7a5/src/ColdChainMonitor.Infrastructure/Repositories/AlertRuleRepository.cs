using MongoDB.Driver;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class AlertRuleRepository : MongoRepositoryBase<AlertRule>, IAlertRuleRepository
{
    public AlertRuleRepository(MongoDbContext context)
        : base(context, context.AlertRules)
    {
    }

    public async Task<List<AlertRule>> GetEnabledRulesAsync()
    {
        var filter = Builders<AlertRule>.Filter.Eq(r => r.IsEnabled, true);
        var sort = Builders<AlertRule>.Sort.Ascending(r => r.Priority);
        return await _collection.Find(filter).Sort(sort).ToListAsync();
    }

    public async Task<AlertRule?> GetByRuleCodeAsync(string ruleCode)
    {
        var filter = Builders<AlertRule>.Filter.Eq(r => r.RuleCode, ruleCode);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<AlertRule>> GetByMetricTypeAsync(MetricType metricType)
    {
        var filter = Builders<AlertRule>.Filter.And(
            Builders<AlertRule>.Filter.Eq(r => r.MetricType, metricType),
            Builders<AlertRule>.Filter.Eq(r => r.IsEnabled, true)
        );
        var sort = Builders<AlertRule>.Sort.Ascending(r => r.Priority);
        return await _collection.Find(filter).Sort(sort).ToListAsync();
    }

    public Task BulkUpdateCacheAsync()
    {
        return Task.CompletedTask;
    }
}
