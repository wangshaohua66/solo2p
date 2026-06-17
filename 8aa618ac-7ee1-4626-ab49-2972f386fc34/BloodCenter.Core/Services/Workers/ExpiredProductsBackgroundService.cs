using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BloodCenter.Core.Services.Workers;

public class ExpiredProductsBackgroundService : BackgroundService
{
    private readonly ILogger<ExpiredProductsBackgroundService> _logger;
    private readonly IOptions<BackgroundWorkerOptions> _options;
    private readonly IServiceScopeFactory _scopeFactory;

    public ExpiredProductsBackgroundService(
        ILogger<ExpiredProductsBackgroundService> logger,
        IOptions<BackgroundWorkerOptions> options,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _options = options;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExpiredProductsBackgroundService is starting. Interval: {IntervalMinutes} minutes",
            _options.Value.IntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("ExpiredProductsBackgroundService tick started");

                using var scope = _scopeFactory.CreateScope();

                var scrapTraceService = scope.ServiceProvider.GetRequiredService<IScrapTraceService>();
                var inventoryService = scope.ServiceProvider.GetRequiredService<IInventoryService>();

                var scrapCount = await ProcessAutoScrapAsync(scrapTraceService, stoppingToken);
                await inventoryService.CheckAndSendAlertsAsync(stoppingToken);

                _logger.LogInformation("ExpiredProductsBackgroundService tick completed. Scrapped {ScrapCount} products",
                    scrapCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while executing ExpiredProductsBackgroundService tick");
            }

            await Task.Delay(TimeSpan.FromMinutes(_options.Value.IntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("ExpiredProductsBackgroundService is stopping");
    }

    private async Task<int> ProcessAutoScrapAsync(IScrapTraceService scrapTraceService, CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("Starting auto-scrap for expired products");
            var count = await scrapTraceService.ProcessAutoScrapForExpiredProductsAsync(stoppingToken);
            _logger.LogInformation("Auto-scrap for expired products completed. {Count} products scrapped", count);
            return count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during auto-scrap processing");
            throw;
        }
    }
}
