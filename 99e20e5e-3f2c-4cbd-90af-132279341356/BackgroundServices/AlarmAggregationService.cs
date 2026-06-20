using FireIoTPlatform.Services;

namespace FireIoTPlatform.BackgroundServices;

public class AlarmAggregationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AlarmAggregationService> _logger;

    public AlarmAggregationService(IServiceProvider serviceProvider, ILogger<AlarmAggregationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("告警聚合服务已启动");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var alarmService = scope.ServiceProvider.GetRequiredService<IAlarmService>();
                await alarmService.AggregateAlarmsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "告警聚合服务执行异常");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }

        _logger.LogInformation("告警聚合服务已停止");
    }
}
