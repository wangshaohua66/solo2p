using FireIoTPlatform.Services;

namespace FireIoTPlatform.BackgroundServices;

public class ScheduledTaskService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScheduledTaskService> _logger;

    public ScheduledTaskService(IServiceProvider serviceProvider, ILogger<ScheduledTaskService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("定时任务服务已启动");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var inspectionService = scope.ServiceProvider.GetRequiredService<IInspectionService>();
                var maintenanceService = scope.ServiceProvider.GetRequiredService<IMaintenanceService>();
                var thirdPartyService = scope.ServiceProvider.GetRequiredService<IThirdPartyIntegrationService>();

                var now = DateTime.Now;

                if (now.Hour == 1 && now.Minute < 5)
                {
                    _logger.LogInformation("执行每日巡检任务生成...");
                    await inspectionService.GenerateRecurringTasksAsync();
                }

                if (now.Hour == 2 && now.Minute < 5)
                {
                    _logger.LogInformation("执行每日隐患超期升级...");
                    await inspectionService.EscalateOverdueHazardsAsync();
                }

                if (now.Hour == 3 && now.Minute < 5)
                {
                    _logger.LogInformation("执行每日维保合同到期提醒...");
                    await maintenanceService.SendExpiryRemindersAsync();
                }

                if (now.Minute % 30 < 5)
                {
                    _logger.LogInformation("执行第三方警情同步...");
                    await thirdPartyService.PullCommandCenterAlarmsAsync();
                }

                if (now.Day == 1 && now.Hour == 4 && now.Minute < 10)
                {
                    _logger.LogInformation("执行下月设备数据分表创建...");
                    var shardingService = scope.ServiceProvider.GetRequiredService<IDeviceDataShardingService>();
                    var nextMonth = now.AddMonths(1);
                    await shardingService.EnsureTableExistsAsync(nextMonth);
                    _logger.LogInformation($"下月分表创建完成: {shardingService.GetTableName(nextMonth)}");
                }

                if (now.Day == 1 && now.Hour == 5 && now.Minute < 10)
                {
                    _logger.LogInformation("执行历史数据清理...");
                    var shardingService = scope.ServiceProvider.GetRequiredService<IDeviceDataShardingService>();
                    var retentionMonths = 36;
                    await shardingService.CleanupOldDataAsync(retentionMonths);
                    _logger.LogInformation($"历史数据清理完成，保留最近{retentionMonths}个月");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "定时任务服务执行异常");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }

        _logger.LogInformation("定时任务服务已停止");
    }
}
