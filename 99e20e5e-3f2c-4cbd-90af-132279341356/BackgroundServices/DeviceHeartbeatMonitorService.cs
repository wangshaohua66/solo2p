using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Services;
using FireIoTPlatform.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace FireIoTPlatform.BackgroundServices;

public class DeviceHeartbeatMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeviceHeartbeatMonitorService> _logger;
    private readonly IConfiguration _config;

    public DeviceHeartbeatMonitorService(IServiceProvider serviceProvider,
        ILogger<DeviceHeartbeatMonitorService> logger, IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("设备心跳监测服务已启动");
        var offlineThreshold = int.TryParse(_config["DeviceSettings:OfflineThresholdSeconds"], out var s) ? s : 90;
        var checkInterval = int.TryParse(_config["DeviceSettings:HeartbeatIntervalSeconds"], out var i) ? i : 30;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
                var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<FireAlarmHub>>();
                var alarmService = scope.ServiceProvider.GetRequiredService<IAlarmService>();

                var cutoffTime = DateTime.Now.AddSeconds(-offlineThreshold);
                var devicesToCheck = await unitOfWork.Devices
                    .FindAsync(d => !d.IsDeleted && d.IsEnabled && d.Status != DeviceStatus.Offline);

                var offlineDevices = devicesToCheck.Where(d =>
                    !d.LastHeartbeatAt.HasValue || d.LastHeartbeatAt < cutoffTime).ToList();

                foreach (var device in offlineDevices)
                {
                    if (device.Status != DeviceStatus.Offline)
                    {
                        device.Status = DeviceStatus.Offline;
                        unitOfWork.Devices.Update(device);
                        _logger.LogWarning($"设备离线: DeviceCode={device.DeviceCode}, FireUnitId={device.FireUnitId}");

                        await hubContext.Clients.Group($"unit_{device.FireUnitId}").SendAsync("DeviceOffline", new
                        {
                            device.Id,
                            device.DeviceCode,
                            Status = DeviceStatus.Offline,
                            Timestamp = DateTime.Now,
                            device.FireUnitId
                        });

                        await alarmService.CreateAlarmAsync(device.Id, "设备离线，超过心跳阈值未上报");
                    }
                }

                await unitOfWork.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "设备心跳监测服务执行异常");
            }

            await Task.Delay(TimeSpan.FromSeconds(checkInterval), stoppingToken);
        }

        _logger.LogInformation("设备心跳监测服务已停止");
    }
}
