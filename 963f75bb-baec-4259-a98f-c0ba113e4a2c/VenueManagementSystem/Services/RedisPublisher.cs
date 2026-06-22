using StackExchange.Redis;
using System.Diagnostics;
using System.Text;
using VenueManagementSystem.Common;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// Redis 发布者实现类
/// 提供基于 Redis 订阅/发布模式的消息推送功能
/// </summary>
public class RedisPublisher : IRedisPublisher
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisPublisher> _logger;

    /// <summary>
    /// 初始化 Redis 发布者
    /// </summary>
    /// <param name="redis">Redis 连接多路复用器</param>
    /// <param name="logger">日志记录器</param>
    public RedisPublisher(IConnectionMultiplexer redis, ILogger<RedisPublisher> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 异步发布排期更新消息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventData">排期事件数据</param>
    /// <returns>发布是否成功</returns>
    public async Task<bool> PublishScheduleUpdateAsync(int venueId, object eventData)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始发布排期更新消息，场馆ID: {VenueId}", venueId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (eventData == null)
                throw new ArgumentNullException(nameof(eventData));

            var channel = $"{RedisKeyPrefix.Channel}schedule:{venueId}";
            var message = Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                type = "schedule_update",
                venueId,
                timestamp = DateTime.UtcNow,
                data = eventData
            });

            var subscriber = _redis.GetSubscriber();
            var published = await subscriber.PublishAsync(channel, message);

            if (published > 0)
            {
                _logger.LogInformation("排期更新消息发布成功，频道: {Channel}，接收订阅者数: {Count}，耗时: {Elapsed}ms",
                    channel, published, stopwatch.ElapsedMilliseconds);
                return true;
            }
            else
            {
                _logger.LogWarning("排期更新消息发布无订阅者，频道: {Channel}，耗时: {Elapsed}ms",
                    channel, stopwatch.ElapsedMilliseconds);
                return true;
            }
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发布排期更新消息失败，场馆ID: {VenueId}", venueId);
            return false;
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步发布应急更新消息
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="eventData">应急事件数据</param>
    /// <returns>发布是否成功</returns>
    public async Task<bool> PublishEmergencyUpdateAsync(int logId, object eventData)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始发布应急更新消息，日志ID: {LogId}", logId);

            if (logId <= 0)
                throw new ArgumentException("日志ID必须大于0", nameof(logId));
            if (eventData == null)
                throw new ArgumentNullException(nameof(eventData));

            var channel = $"{RedisKeyPrefix.Channel}emergency:{logId}";
            var broadcastChannel = $"{RedisKeyPrefix.Channel}emergency:all";
            var message = Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                type = "emergency_update",
                logId,
                timestamp = DateTime.UtcNow,
                data = eventData
            });

            var subscriber = _redis.GetSubscriber();

            var tasks = new[]
            {
                subscriber.PublishAsync(channel, message),
                subscriber.PublishAsync(broadcastChannel, message)
            };

            await Task.WhenAll(tasks);

            var totalPublished = tasks.Sum(t => t.Result);

            if (totalPublished > 0)
            {
                _logger.LogInformation("应急更新消息发布成功，日志ID: {LogId}，接收订阅者数: {Count}，耗时: {Elapsed}ms",
                    logId, totalPublished, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogWarning("应急更新消息发布无订阅者，日志ID: {LogId}，耗时: {Elapsed}ms",
                    logId, stopwatch.ElapsedMilliseconds);
            }

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发布应急更新消息失败，日志ID: {LogId}", logId);
            return false;
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步发布资源状态更新消息
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <param name="status">资源状态</param>
    /// <returns>发布是否成功</returns>
    public async Task<bool> PublishResourceStatusAsync(int resourceId, string status)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始发布资源状态更新消息，资源ID: {ResourceId}，新状态: {Status}",
                resourceId, status);

            if (resourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(resourceId));
            if (string.IsNullOrWhiteSpace(status))
                throw new ArgumentException("资源状态不能为空", nameof(status));

            var channel = $"{RedisKeyPrefix.Channel}resource:{resourceId}";
            var broadcastChannel = $"{RedisKeyPrefix.Channel}resource:all";
            var message = Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                type = "resource_status",
                resourceId,
                status,
                timestamp = DateTime.UtcNow
            });

            var subscriber = _redis.GetSubscriber();

            var tasks = new[]
            {
                subscriber.PublishAsync(channel, message),
                subscriber.PublishAsync(broadcastChannel, message)
            };

            await Task.WhenAll(tasks);

            var totalPublished = tasks.Sum(t => t.Result);

            if (totalPublished > 0)
            {
                _logger.LogInformation("资源状态更新消息发布成功，资源ID: {ResourceId}，新状态: {Status}，接收订阅者数: {Count}，耗时: {Elapsed}ms",
                    resourceId, status, totalPublished, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogWarning("资源状态更新消息发布无订阅者，资源ID: {ResourceId}，耗时: {Elapsed}ms",
                    resourceId, stopwatch.ElapsedMilliseconds);
            }

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发布资源状态更新消息失败，资源ID: {ResourceId}", resourceId);
            return false;
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
