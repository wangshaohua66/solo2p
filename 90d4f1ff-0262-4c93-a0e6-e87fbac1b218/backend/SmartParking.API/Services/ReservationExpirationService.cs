using Microsoft.EntityFrameworkCore;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

/// <summary>
/// 预约超时自动释放服务
/// 每分钟检测一次，预约开始后15分钟未确认使用则自动取消并释放资源
/// </summary>
public class ReservationExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReservationExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
    private readonly TimeSpan _gracePeriod = TimeSpan.FromMinutes(15);

    public ReservationExpirationService(
        IServiceProvider serviceProvider,
        ILogger<ReservationExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("预约超时自动释放服务已启动，检测间隔: {Interval}", _checkInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckExpiredReservationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "检测超时预约时发生异常");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("预约超时自动释放服务已停止");
    }

    private async Task CheckExpiredReservationsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

        var now = DateTime.UtcNow;
        var cutoffTime = now - _gracePeriod;

        var expiredReservations = await context.ChargingReservations
            .Where(r => r.Status == "Active"
                && r.StartTime <= cutoffTime
                && !r.ExpireNotified)
            .ToListAsync(cancellationToken);

        if (expiredReservations.Count == 0) return;

        _logger.LogInformation("发现 {Count} 个超时预约，即将自动释放", expiredReservations.Count);

        foreach (var reservation in expiredReservations)
        {
            try
            {
                reservation.Status = "Expired";
                reservation.ExpireNotified = true;
                reservation.UpdatedAt = now;

                var station = await context.ChargingStations
                    .FirstOrDefaultAsync(s => s.Id == reservation.StationId, cancellationToken);

                if (station != null && station.Status == ChargingStationStatus.Reserved)
                {
                    station.Status = ChargingStationStatus.Idle;
                    station.UpdatedAt = now;

                    await hubContext.Clients.Group($"station:{station.Id}")
                        .SendAsync("ChargingStationUpdated", station, cancellationToken);
                }

                await notificationService.NotifyUserAsync(
                    reservation.UserId,
                    $"您的预约（{reservation.StationCode}）已超时15分钟未使用，已自动取消",
                    "warning");

                await hubContext.Clients.Group($"user:{reservation.UserId}")
                    .SendAsync("ReservationExpired", reservation.Id, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "处理超时预约失败 ReservationId={ReservationId}", reservation.Id);
            }
        }

        await context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("已处理 {Count} 个超时预约", expiredReservations.Count);
    }
}
