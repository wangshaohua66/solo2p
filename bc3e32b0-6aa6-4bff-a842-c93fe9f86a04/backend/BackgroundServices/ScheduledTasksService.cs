using PotteryStudio.Services;

namespace PotteryStudio.BackgroundServices;

public class ScheduledTasksService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScheduledTasksService> _logger;

    public ScheduledTasksService(IServiceProvider serviceProvider, ILogger<ScheduledTasksService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Scheduled Tasks Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddHours(3);
            
            if (nextRun <= now)
                nextRun = nextRun.AddDays(1);

            var delay = nextRun - now;
            _logger.LogInformation($"Next scheduled tasks run at {nextRun} UTC");

            await Task.Delay(delay, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunDailyTasksAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error running scheduled tasks");
                }
            }
        }

        _logger.LogInformation("Scheduled Tasks Service is stopping.");
    }

    private async Task RunDailyTasksAsync()
    {
        _logger.LogInformation("Starting daily scheduled tasks...");

        using var scope = _serviceProvider.CreateScope();
        
        var memberService = scope.ServiceProvider.GetRequiredService<IMemberService>();
        var inventoryService = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        await memberService.CheckMembershipExpiryAsync();
        _logger.LogInformation("Membership expiry check completed.");

        await inventoryService.CheckInventoryAlertsAsync();
        _logger.LogInformation("Inventory alerts check completed.");

        await CleanupOldLogsAndCacheAsync(scope.ServiceProvider);
        _logger.LogInformation("Old logs and cache cleanup completed.");

        _logger.LogInformation("Daily scheduled tasks completed successfully.");
    }

    private Task CleanupOldLogsAndCacheAsync(IServiceProvider services)
    {
        try
        {
            var env = services.GetRequiredService<IWebHostEnvironment>();
            var cacheDir = Path.Combine(env.WebRootPath, "uploads", "chunks");
            
            if (Directory.Exists(cacheDir))
            {
                var oldDirs = Directory.GetDirectories(cacheDir)
                    .Where(d => Directory.GetCreationTime(d) < DateTime.UtcNow.AddDays(-30))
                    .ToList();

                foreach (var dir in oldDirs)
                {
                    try
                    {
                        Directory.Delete(dir, true);
                    }
                    catch { }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error cleaning up cache files");
        }

        return Task.CompletedTask;
    }
}
