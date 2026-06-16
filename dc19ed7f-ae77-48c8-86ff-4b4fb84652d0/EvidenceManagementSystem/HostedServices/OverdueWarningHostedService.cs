using EvidenceManagementSystem.Services;

namespace EvidenceManagementSystem.HostedServices;

public class OverdueWarningHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OverdueWarningHostedService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public OverdueWarningHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<OverdueWarningHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("超期预警后台服务已启动");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var warningService = scope.ServiceProvider.GetRequiredService<IOverdueWarningService>();

                _logger.LogInformation("开始扫描超期物证...");
                await warningService.GenerateWarningsAsync();
                _logger.LogInformation("超期物证扫描完成");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "扫描超期物证时发生错误");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("超期预警后台服务已停止");
    }
}
