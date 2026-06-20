namespace FireTraining.Services;

public class OverdueReminderBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OverdueReminderBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public OverdueReminderBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<OverdueReminderBackgroundService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("逾期提醒后台服务启动");

        var intervalMinutes = _configuration.GetValue<int>("OverdueReminder:IntervalMinutes", 60);
        var checkHour = _configuration.GetValue<int>("OverdueReminder:CheckHour", 8);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.Now;

                if (now.Hour == checkHour)
                {
                    using var scope = _serviceProvider.CreateScope();
                    var equipmentService = scope.ServiceProvider.GetRequiredService<IEquipmentService>();

                    _logger.LogInformation("开始执行逾期提醒检查...");
                    await equipmentService.SendOverdueRemindersAsync(stoppingToken);
                    _logger.LogInformation("逾期提醒检查完成");
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "逾期提醒后台服务执行出错");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }

        _logger.LogInformation("逾期提醒后台服务停止");
    }
}
