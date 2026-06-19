using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Services;

namespace MiningGovApi.Background;

public class AlertEscalationHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AlertEscalationHostedService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    public AlertEscalationHostedService(
        IServiceProvider serviceProvider,
        ILogger<AlertEscalationHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Alert Escalation Hosted Service is running. Check interval: {Interval}m",
            _checkInterval.TotalMinutes);

        using var periodicTimer = new PeriodicTimer(_checkInterval);
        try
        {
            while (await periodicTimer.WaitForNextTickAsync(stoppingToken))
            {
                await DoWorkAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Alert Escalation Hosted Service is stopping");
        }
    }

    private async Task DoWorkAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ISafetyService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notification = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var cutoffTime = DateTime.UtcNow.AddHours(-4);
            var toEscalate = await dbContext.SafetyAlerts
                .Where(sa => (sa.Status == AlertStatus.Created || sa.Status == AlertStatus.Assigned)
                            && sa.CreatedAt < cutoffTime
                            && sa.EscalatedAt == null)
                .ToListAsync(ct);

            var supervisor = await dbContext.Users
                .FirstOrDefaultAsync(u => u.Role == UserRole.SafetyInspector && u.IsActive, ct);

            foreach (var alert in toEscalate)
            {
                await notification.SendAlertEscalationAsync(
                    alert.Id,
                    alert.AssignedInspectorId ?? 0,
                    supervisor?.Id ?? 0,
                    ct);
            }

            await service.CheckAndEscalateAlertsAsync();
            _logger.LogInformation("Alert Escalation check completed. Processed {Count} alerts", toEscalate.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while processing alert escalations");
        }
    }
}
