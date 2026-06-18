using HazChemSupervision.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HazChemSupervision.BackgroundServices;

public class AlertCheckBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AlertCheckBackgroundService> _logger;

    public AlertCheckBackgroundService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<AlertCheckBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalMinutes = _configuration.GetValue<int>("Alert:BackgroundCheckIntervalMinutes", 5);
        _logger.LogInformation("预警检查后台服务已启动，检查间隔: {Interval} 分钟", intervalMinutes);

        using var periodicTimer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunAlertChecksAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "预警检查后台任务执行异常");
            }

            try
            {
                await periodicTimer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("预警检查后台服务已停止");
    }

    private async Task RunAlertChecksAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("开始执行预警检查周期任务");

        using var scope = _serviceProvider.CreateScope();
        var alertService = scope.ServiceProvider.GetRequiredService<IAlertService>();

        var checkTasks = new List<Task>
        {
            SafeExecuteAsync("库存预警检查", () => alertService.CheckAndGenerateInventoryAlertsAsync(), stoppingToken),
            SafeExecuteAsync("运输预警检查", () => alertService.CheckAndGenerateTransportAlertsAsync(), stoppingToken),
            SafeExecuteAsync("隐患预警检查", () => alertService.CheckAndGenerateHazardAlertsAsync(), stoppingToken),
            SafeExecuteAsync("演练预警检查", () => alertService.CheckAndGenerateDrillAlertsAsync(), stoppingToken),
            SafeExecuteAsync("证书预警检查", () => alertService.CheckAndGenerateCertificateAlertsAsync(), stoppingToken)
        };

        await Task.WhenAll(checkTasks);

        _logger.LogInformation("预警检查周期任务执行完成");
    }

    private async Task SafeExecuteAsync(string taskName, Func<Task> taskFunc, CancellationToken stoppingToken)
    {
        try
        {
            stoppingToken.ThrowIfCancellationRequested();
            await taskFunc();
            _logger.LogDebug("{TaskName} 执行成功", taskName);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("{TaskName} 被取消", taskName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{TaskName} 执行异常", taskName);
        }
    }
}
