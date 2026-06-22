using Hangfire;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using VenueManagementSystem.Common;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 票务数据同步任务
/// 实现 IJob 接口
/// 每15分钟同步票务数据
/// </summary>
[DisplayName("票务数据同步任务")]
public class TicketDataSyncer : IJob
{
    private readonly ITicketService _ticketService;
    private readonly IDatabase _redis;
    private readonly ILogger<TicketDataSyncer> _logger;

    /// <summary>
    /// 初始化票务数据同步任务
    /// </summary>
    /// <param name="ticketService">票务服务</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    public TicketDataSyncer(
        ITicketService ticketService,
        IDatabase redis,
        ILogger<TicketDataSyncer> logger)
    {
        _ticketService = ticketService;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 执行票务数据同步任务
    /// </summary>
    [DisplayName("同步票务数据")]
    public async Task ExecuteAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始执行票务数据同步任务");

            var syncCount = await _ticketService.SyncTicketDataAsync();

            var now = DateTime.UtcNow;
            await _redis.StringSetAsync(
                $"{RedisKeyPrefix.Ticket}lastSync",
                now.ToString("o"),
                TimeSpan.FromMinutes(20));

            if (syncCount > 0)
            {
                _logger.LogInformation(
                    "票务数据同步任务完成，同步记录数: {SyncCount}条，耗时: {Elapsed}ms",
                    syncCount,
                    stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogInformation(
                    "票务数据同步任务完成，无新数据，耗时: {Elapsed}ms",
                    stopwatch.ElapsedMilliseconds);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "票务数据同步任务执行失败");
            throw;
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
