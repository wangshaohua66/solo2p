using BlueprintReview.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BlueprintReview.Services;

public class ReviewReminderHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReviewReminderHostedService> _logger;
    private readonly ReminderSettings _settings;
    private int _executionCount = 0;

    public ReviewReminderHostedService(
        IServiceProvider serviceProvider,
        ILogger<ReviewReminderHostedService> logger,
        IOptions<ReminderSettings> settings)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _settings = settings.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Review Reminder Hosted Service running. Check interval: {IntervalMinutes} minutes",
            _settings.CheckIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(_settings.CheckIntervalMinutes), stoppingToken);

            try
            {
                _executionCount++;
                _logger.LogInformation(
                    "Review Reminder Service checking for overdue reviews (execution #{Count})",
                    _executionCount);

                using (var scope = _serviceProvider.CreateScope())
                {
                    var workflowService = scope.ServiceProvider.GetRequiredService<IReviewWorkflowService>();
                    await workflowService.CheckAndSendRemindersAsync();
                }

                _logger.LogInformation(
                    "Review Reminder Service check completed successfully (execution #{Count})",
                    _executionCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "An error occurred while checking for overdue reviews (execution #{Count})",
                    _executionCount);
            }
        }

        _logger.LogInformation("Review Reminder Hosted Service is stopping.");
    }

    public override async Task StopAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Review Reminder Hosted Service has stopped. Total executions: {Count}",
            _executionCount);

        await base.StopAsync(stoppingToken);
    }
}
