using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class AlertRuleRepository : PagedRepository<AlertRule>, IAlertRuleRepository
{
    public AlertRuleRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<AlertRule>> GetActiveRulesAsync(long? customerId = null)
    {
        var query = _dbSet.Where(r => r.IsEnabled);
        if (customerId.HasValue)
        {
            query = query.Where(r => r.CustomerId == customerId || r.CustomerId == null);
        }
        return await query
            .OrderBy(r => r.Priority)
            .ToListAsync();
    }

    public async Task<List<AlertRule>> GetRulesWithConditionsAsync(long? customerId = null)
    {
        var query = _dbSet
            .Include(r => r.Conditions)
            .Where(r => r.IsEnabled);

        if (customerId.HasValue)
        {
            query = query.Where(r => r.CustomerId == customerId || r.CustomerId == null);
        }

        return await query
            .OrderBy(r => r.Priority)
            .ToListAsync();
    }

    public async Task<AlertRule?> GetWithConditionsAsync(long id)
    {
        return await _dbSet
            .Include(r => r.Conditions)
            .FirstOrDefaultAsync(r => r.Id == id);
    }
}

public class AlertRepository : PagedRepository<Alert>, IAlertRepository
{
    public AlertRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Alert?> GetByAlertCodeAsync(string alertCode)
    {
        return await _dbSet.FirstOrDefaultAsync(a => a.AlertCode == alertCode);
    }

    public async Task<List<Alert>> GetActiveAlertsAsync(long? customerId = null, long? vehicleId = null)
    {
        var query = _dbSet.Where(a => a.Status != AlertStatus.Resolved && a.Status != AlertStatus.Closed);

        if (customerId.HasValue)
        {
            query = query.Where(a => a.CustomerId == customerId);
        }
        if (vehicleId.HasValue)
        {
            query = query.Where(a => a.VehicleId == vehicleId);
        }

        return await query
            .OrderByDescending(a => a.FirstTriggeredAt)
            .ToListAsync();
    }

    public async Task<List<Alert>> GetAlertsForEscalationAsync(DateTime beforeTime)
    {
        return await _dbSet
            .Where(a => a.Status != AlertStatus.Resolved
                && a.Status != AlertStatus.Closed
                && a.Status != AlertStatus.Escalated
                && a.NextEscalationAt <= beforeTime
                && !a.IsEscalated)
            .Include(a => a.Customer)
            .Include(a => a.AlertRule)
            .ToListAsync();
    }

    public async Task<int> GetActiveAlertCountBySensorIdAsync(long sensorId, long alertRuleId)
    {
        return await _dbSet.CountAsync(a =>
            a.SensorId == sensorId
            && a.AlertRuleId == alertRuleId
            && a.Status != AlertStatus.Resolved
            && a.Status != AlertStatus.Closed);
    }

    public async Task<int> GetActiveOfflineAlertCountBySensorIdAsync(long sensorId)
    {
        return await _dbSet.CountAsync(a =>
            a.SensorId == sensorId
            && a.TriggerMetric == "offline"
            && a.Status != AlertStatus.Resolved
            && a.Status != AlertStatus.Closed);
    }

    public async Task<Alert?> GetActiveAlertByRuleAndSensorAsync(long alertRuleId, long sensorId)
    {
        return await _dbSet
            .OrderByDescending(a => a.LastTriggeredAt)
            .FirstOrDefaultAsync(a =>
                a.AlertRuleId == alertRuleId
                && a.SensorId == sensorId
                && a.Status != AlertStatus.Resolved
                && a.Status != AlertStatus.Closed);
    }
}

public class NotificationRecordRepository : Repository<NotificationRecord>, INotificationRecordRepository
{
    public NotificationRecordRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<NotificationRecord>> GetByAlertIdAsync(long alertId)
    {
        return await _dbSet
            .Where(n => n.AlertId == alertId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<NotificationRecord>> GetPendingNotificationsAsync()
    {
        return await _dbSet
            .Where(n => !n.IsSent && n.RetryCount < 3)
            .OrderBy(n => n.CreatedAt)
            .Take(100)
            .ToListAsync();
    }
}
