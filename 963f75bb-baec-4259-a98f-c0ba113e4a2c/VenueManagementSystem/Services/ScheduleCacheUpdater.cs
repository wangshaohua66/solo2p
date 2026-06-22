using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 档期缓存更新任务
/// 实现 IJob 接口（Hangfire）
/// 每分钟更新 Redis 缓存
/// 覆盖未来 365 天档期数据
/// 检测并释放过期锁定
/// </summary>
[DisplayName("档期缓存更新任务")]
public class ScheduleCacheUpdater : IJob
{
    private readonly IScheduleEngine _scheduleEngine;
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<ScheduleCacheUpdater> _logger;

    /// <summary>
    /// 初始化档期缓存更新任务
    /// </summary>
    /// <param name="scheduleEngine">排期引擎</param>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    public ScheduleCacheUpdater(
        IScheduleEngine scheduleEngine,
        AppDbContext context,
        IDatabase redis,
        ILogger<ScheduleCacheUpdater> logger)
    {
        _scheduleEngine = scheduleEngine;
        _context = context;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 执行缓存更新任务
    /// </summary>
    [DisplayName("更新档期缓存并释放过期锁定")]
    public async Task ExecuteAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始执行档期缓存更新任务");

            var venues = await _context.Venues
                .AsNoTracking()
                .Where(v => v.Status == "Active")
                .Select(v => v.Id)
                .ToListAsync();

            if (!venues.Any())
            {
                _logger.LogInformation("无活跃场馆，跳过缓存更新");
                return;
            }

            var updateTasks = venues.Select(venueId =>
                _scheduleEngine.UpdateScheduleCacheAsync(venueId));

            var updateResults = await Task.WhenAll(updateTasks);
            var successCount = updateResults.Count(r => r);

            var expiredCount = await _scheduleEngine.ExpireLocksAsync();

            var now = DateTime.UtcNow;
            await _redis.StringSetAsync(
                $"{RedisKeyPrefix.Schedule}lastUpdate",
                now.ToString("o"),
                TimeSpan.FromMinutes(5));

            _logger.LogInformation(
                "档期缓存更新任务完成，更新场馆数: {SuccessCount}/{TotalCount}，释放过期锁定数: {ExpiredCount}，耗时: {Elapsed}ms",
                successCount,
                venues.Count,
                expiredCount,
                stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "档期缓存更新任务执行失败");
            throw;
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
