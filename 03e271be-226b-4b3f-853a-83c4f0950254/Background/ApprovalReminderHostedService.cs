using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MiningGovApi.Data;
using MiningGovApi.Services;

namespace MiningGovApi.Background;

public class ApprovalReminderHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ApprovalReminderHostedService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public ApprovalReminderHostedService(
        IServiceProvider serviceProvider,
        ILogger<ApprovalReminderHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Approval Reminder Hosted Service is running. Check interval: {Interval}h",
            _checkInterval.TotalHours);

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
            _logger.LogInformation("Approval Reminder Hosted Service is stopping");
        }
    }

    private async Task DoWorkAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IMiningRightService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notification = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var cutoffTime = DateTime.UtcNow.AddHours(-48);
            var pending = await dbContext.MiningRightApprovals
                .Where(a => a.Status == Models.ApprovalStatus.Pending && a.CreatedAt < cutoffTime)
                .Include(a => a.MiningRight)
                .ToListAsync(ct);

            foreach (var approval in pending)
            {
                var delayHours = (int)(DateTime.UtcNow - (approval.CreatedAt ?? DateTime.UtcNow)).TotalHours;
                await notification.SendApprovalReminderAsync(
                    approval.MiningRightId,
                    approval.ApprovalLevel,
                    delayHours,
                    ct);
            }

            await service.CheckAndRemindPendingApprovalsAsync();
            _logger.LogInformation("Approval Reminder check completed. Processed {Count} pending records", pending.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while processing approval reminders");
        }
    }
}
