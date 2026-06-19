using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Services;

namespace MiningGovApi.Background;

public class FeeReminderHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<FeeReminderHostedService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6);

    public FeeReminderHostedService(
        IServiceProvider serviceProvider,
        ILogger<FeeReminderHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Fee Reminder Hosted Service is running. Check interval: {Interval}h",
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
            _logger.LogInformation("Fee Reminder Hosted Service is stopping");
        }
    }

    private async Task DoWorkAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IReportService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notification = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var today = DateTime.UtcNow;
            var overdueFees = await dbContext.FeeRecords
                .Where(fr => (fr.Status == FeeStatus.Billed || fr.Status == FeeStatus.Pending)
                            && fr.DueDate < today)
                .ToListAsync(ct);

            int remindedCount = 0;
            foreach (var fee in overdueFees)
            {
                var daysOverdue = (int)(today - fee.DueDate).TotalDays;
                var overdueAmount = fee.TotalAmount - fee.PaidAmount + fee.LateFee;

                if (daysOverdue >= 30 && (fee.RemindedAt == null
                    || (today - fee.RemindedAt.Value).TotalDays >= 7))
                {
                    await notification.SendFeeReminderAsync(
                        fee.Id,
                        daysOverdue,
                        overdueAmount,
                        ct);
                    fee.RemindedAt = today;
                    remindedCount++;
                }
            }

            await dbContext.SaveChangesAsync(ct);
            await service.ProcessOverdueFeesAsync();
            _logger.LogInformation("Fee Reminder check completed. Sent {Count} reminders", remindedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while processing fee reminders");
        }
    }
}
