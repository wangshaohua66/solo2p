using Microsoft.EntityFrameworkCore;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

/// <summary>
/// 心跳检测服务
/// 定期检测车位和充电桩心跳，超过阈值标记为离线状态
/// </summary>
public class HeartbeatMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<HeartbeatMonitorService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);
    private readonly TimeSpan _parkingSpotOfflineThreshold = TimeSpan.FromSeconds(60);
    private readonly TimeSpan _chargingStationOfflineThreshold = TimeSpan.FromSeconds(90);

    public HeartbeatMonitorService(
        IServiceProvider serviceProvider,
        ILogger<HeartbeatMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("心跳检测服务已启动，检测间隔: {Interval}", _checkInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckParkingSpotsAsync(stoppingToken);
                await CheckChargingStationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "心跳检测时发生异常");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("心跳检测服务已停止");
    }

    private async Task CheckParkingSpotsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

        var now = DateTime.UtcNow;
        var cutoffTime = now - _parkingSpotOfflineThreshold;

        var spotsToOffline = await context.ParkingSpots
            .Where(s => s.Status != ParkingSpotStatus.Offline
                && s.LastHeartbeat.HasValue
                && s.LastHeartbeat.Value < cutoffTime)
            .ToListAsync(cancellationToken);

        if (spotsToOffline.Count == 0) return;

        _logger.LogInformation("发现 {Count} 个车位心跳超时，将标记为离线", spotsToOffline.Count);

        foreach (var spot in spotsToOffline)
        {
            spot.Status = ParkingSpotStatus.Offline;
            spot.UpdatedAt = now;
        }

        await context.SaveChangesAsync(cancellationToken);

        foreach (var spot in spotsToOffline)
        {
            await hubContext.Clients.Group($"parking:{spot.FloorId}")
                .SendAsync("ParkingSpotUpdated", spot, cancellationToken);
        }

        _logger.LogInformation("已标记 {Count} 个车位为离线状态", spotsToOffline.Count);
    }

    private async Task CheckChargingStationsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

        var now = DateTime.UtcNow;
        var cutoffTime = now - _chargingStationOfflineThreshold;

        var stationsToOffline = await context.ChargingStations
            .Where(s => s.Status != ChargingStationStatus.Offline
                && s.LastHeartbeat.HasValue
                && s.LastHeartbeat.Value < cutoffTime)
            .ToListAsync(cancellationToken);

        if (stationsToOffline.Count == 0) return;

        _logger.LogInformation("发现 {Count} 个充电桩心跳超时，将标记为离线", stationsToOffline.Count);

        foreach (var station in stationsToOffline)
        {
            station.Status = ChargingStationStatus.Offline;
            station.UpdatedAt = now;
        }

        await context.SaveChangesAsync(cancellationToken);

        foreach (var station in stationsToOffline)
        {
            await hubContext.Clients.Group($"station:{station.Id}")
                .SendAsync("ChargingStationUpdated", station, cancellationToken);
        }

        _logger.LogInformation("已标记 {Count} 个充电桩为离线状态", stationsToOffline.Count);
    }
}
