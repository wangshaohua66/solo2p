using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class DeviceMaintenanceWindowRepository : Repository<DeviceMaintenanceWindow>, IDeviceMaintenanceWindowRepository
{
    public DeviceMaintenanceWindowRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<DeviceMaintenanceWindow>> GetBySensorIdAsync(long sensorId)
    {
        return await _dbSet
            .Where(w => w.SensorId == sensorId)
            .OrderByDescending(w => w.StartTime)
            .ToListAsync();
    }

    public async Task<List<DeviceMaintenanceWindow>> GetActiveWindowsAsync(DateTime time)
    {
        return await _dbSet
            .Where(w => w.StartTime <= time && w.EndTime >= time && !w.IsDeleted)
            .ToListAsync();
    }
}

public class NotificationPreferenceRepository : Repository<NotificationPreference>, INotificationPreferenceRepository
{
    public NotificationPreferenceRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<NotificationPreference>> GetByCustomerIdAsync(long customerId)
    {
        return await _dbSet
            .Where(p => p.CustomerId == customerId && p.IsEnabled && !p.IsDeleted)
            .OrderBy(p => p.EscalationLevel)
            .ToListAsync();
    }

    public async Task<List<NotificationPreference>> GetByCustomerAndSeverityAsync(long customerId, AlertSeverity severity)
    {
        return await _dbSet
            .Where(p => p.CustomerId == customerId
                && p.Severity == severity
                && p.IsEnabled
                && !p.IsDeleted)
            .OrderBy(p => p.EscalationLevel)
            .ToListAsync();
    }
}

public class AlertRuleAuditLogRepository : Repository<AlertRuleAuditLog>, IAlertRuleAuditLogRepository
{
    public AlertRuleAuditLogRepository(AppDbContext context) : base(context)
    {
    }

    public async Task AddAuditLogAsync(AlertRuleAuditLog auditLog)
    {
        await _dbSet.AddAsync(auditLog);
        await _context.SaveChangesAsync();
    }

    public async Task<List<AlertRuleAuditLog>> GetAuditLogsByRuleIdAsync(long ruleId)
    {
        return await _dbSet
            .Where(l => l.AlertRuleId == ruleId && !l.IsDeleted)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
    }
}
