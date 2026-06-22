using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using System.Net.Http.Json;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 通知服务实现类
/// 提供 APP/短信/邮件/电话 多渠道通知推送
/// 性能要求：< 10秒送达全部相关岗位
/// </summary>
public class NotificationService : INotificationService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<NotificationService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IRedisPublisher _redisPublisher;

    private static readonly HashSet<string> ValidChannels = new(StringComparer.OrdinalIgnoreCase) { "app", "sms", "email", "phone" };
    private static readonly HashSet<string> ValidPriorities = new(StringComparer.OrdinalIgnoreCase) { "low", "medium", "high", "urgent" };

    /// <summary>
    /// 初始化通知服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="httpClientFactory">HTTP客户端工厂</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public NotificationService(
        AppDbContext context,
        IDatabase redis,
        ILogger<NotificationService> logger,
        IHttpClientFactory httpClientFactory,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步发送通知给指定用户
    /// </summary>
    /// <param name="userId">接收用户ID</param>
    /// <param name="title">通知标题</param>
    /// <param name="message">通知内容</param>
    /// <param name="channel">发送渠道（app/sms/email/phone）</param>
    /// <param name="priority">优先级（low/medium/high/urgent）</param>
    /// <returns>通知ID</returns>
    public async Task<int> SendNotificationAsync(int userId, string title, string message, string channel, string priority)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始发送通知，用户ID: {UserId}，渠道: {Channel}，优先级: {Priority}",
                userId, channel, priority);

            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("通知标题不能为空", nameof(title));
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("通知内容不能为空", nameof(message));
            if (!ValidChannels.Contains(channel))
                throw new ArgumentException($"不支持的通知渠道: {channel}，仅支持: {string.Join(", ", ValidChannels)}", nameof(channel));
            if (!ValidPriorities.Contains(priority))
                throw new ArgumentException($"不支持的优先级: {priority}，仅支持: {string.Join(", ", ValidPriorities)}", nameof(priority));

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                _logger.LogWarning("接收用户不存在，用户ID: {UserId}", userId);
                throw new InvalidOperationException($"接收用户不存在，用户ID: {userId}");
            }

            var notification = new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Channel = channel.ToLower(),
                Status = "Pending",
                Type = "System"
            };

            await _context.Notifications.AddAsync(notification);
            await _context.SaveChangesAsync();

            var sendTasks = new List<Task<bool>>();
            var channels = channel.ToLower() == "all"
                ? new[] { "app", "sms", "email", "phone" }
                : new[] { channel.ToLower() };

            foreach (var ch in channels)
            {
                sendTasks.Add(SendViaChannelAsync(notification.Id, user, ch, title, message, priority));
            }

            var results = await Task.WhenAll(sendTasks);
            var successCount = results.Count(r => r);

            if (successCount > 0)
            {
                notification.Status = "Sent";
                notification.SentAt = DateTime.UtcNow;
            }
            else
            {
                notification.Status = "Failed";
            }

            await _context.SaveChangesAsync();

            if (stopwatch.ElapsedMilliseconds > 10000)
            {
                _logger.LogWarning("通知发送超过性能阈值，通知ID: {NotificationId}，耗时: {Elapsed}ms",
                    notification.Id, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogInformation("通知发送成功，通知ID: {NotificationId}，成功渠道数: {SuccessCount}/{TotalCount}，耗时: {Elapsed}ms",
                    notification.Id, successCount, channels.Length, stopwatch.ElapsedMilliseconds);
            }

            return notification.Id;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发送通知失败，用户ID: {UserId}，渠道: {Channel}", userId, channel);
            throw new InvalidOperationException("发送通知失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步广播通知给指定角色的所有用户
    /// </summary>
    /// <param name="userRoles">目标角色列表</param>
    /// <param name="title">通知标题</param>
    /// <param name="message">通知内容</param>
    /// <param name="priority">优先级</param>
    /// <returns>发送成功的通知数量</returns>
    public async Task<int> BroadcastNotificationAsync(IEnumerable<string> userRoles, string title, string message, string priority)
    {
        var stopwatch = Stopwatch.StartNew();
        var successCount = 0;
        try
        {
            _logger.LogInformation("开始广播通知，目标角色: {Roles}，优先级: {Priority}",
                string.Join(", ", userRoles), priority);

            if (userRoles == null || !userRoles.Any())
                throw new ArgumentException("目标角色列表不能为空", nameof(userRoles));
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("通知标题不能为空", nameof(title));
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("通知内容不能为空", nameof(message));
            if (!ValidPriorities.Contains(priority))
                throw new ArgumentException($"不支持的优先级: {priority}，仅支持: {string.Join(", ", ValidPriorities)}", nameof(priority));

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userRoles.Contains(u.Role) && u.IsActive)
                .ToListAsync();

            if (!users.Any())
            {
                _logger.LogWarning("未找到符合角色条件的活跃用户，角色: {Roles}", string.Join(", ", userRoles));
                return 0;
            }

            var sendTasks = users.Select(user => Task.Run(async () =>
            {
                var channel = priority == "urgent" ? "all" : "app";
                try
                {
                    await SendNotificationAsync(user.Id, title, message, channel, priority);
                    return true;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "向用户 {UserId} 发送广播通知失败", user.Id);
                    return false;
                }
            })).ToList();

            var results = await Task.WhenAll(sendTasks);
            successCount = results.Count(r => r);

            if (stopwatch.ElapsedMilliseconds > 10000)
            {
                _logger.LogWarning("广播通知超过性能阈值，用户数: {UserCount}，耗时: {Elapsed}ms",
                    users.Count, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogInformation("广播通知完成，目标用户数: {UserCount}，成功发送: {SuccessCount}，耗时: {Elapsed}ms",
                    users.Count, successCount, stopwatch.ElapsedMilliseconds);
            }

            return successCount;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "广播通知失败，目标角色: {Roles}", string.Join(", ", userRoles));
            throw new InvalidOperationException("广播通知失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取通知发送状态
    /// </summary>
    /// <param name="notificationId">通知ID</param>
    /// <returns>通知状态信息</returns>
    public async Task<Dictionary<string, object>> GetNotificationStatusAsync(int notificationId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取通知状态，通知ID: {NotificationId}", notificationId);

            if (notificationId <= 0)
                throw new ArgumentException("通知ID必须大于0", nameof(notificationId));

            var cacheKey = $"{RedisKeyPrefix.Notification}status:{notificationId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedStatus = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(cachedData!);
                if (cachedStatus != null)
                {
                    _logger.LogInformation("从Redis缓存获取通知状态成功，通知ID: {NotificationId}，耗时: {Elapsed}ms",
                        notificationId, stopwatch.ElapsedMilliseconds);
                    return cachedStatus;
                }
            }

            var notification = await _context.Notifications
                .AsNoTracking()
                .Include(n => n.User)
                .FirstOrDefaultAsync(n => n.Id == notificationId);

            if (notification == null)
            {
                _logger.LogWarning("通知不存在，通知ID: {NotificationId}", notificationId);
                throw new InvalidOperationException($"通知不存在，通知ID: {notificationId}");
            }

            var result = new Dictionary<string, object>
            {
                ["notificationId"] = notification.Id,
                ["userId"] = notification.UserId,
                ["userName"] = notification.User?.FullName ?? notification.User?.Username ?? string.Empty,
                ["title"] = notification.Title,
                ["channel"] = notification.Channel,
                ["status"] = notification.Status,
                ["priority"] = "medium",
                ["sentAt"] = notification.SentAt,
                ["deliveredAt"] = notification.DeliveredAt,
                ["createdAt"] = notification.Id
            };

            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(result),
                TimeSpan.FromMinutes(5));

            _logger.LogInformation("获取通知状态成功，通知ID: {NotificationId}，状态: {Status}，耗时: {Elapsed}ms",
                notificationId, notification.Status, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取通知状态失败，通知ID: {NotificationId}", notificationId);
            throw new InvalidOperationException("获取通知状态失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 通过指定渠道发送通知
    /// </summary>
    /// <param name="notificationId">通知ID</param>
    /// <param name="user">接收用户</param>
    /// <param name="channel">发送渠道</param>
    /// <param name="title">通知标题</param>
    /// <param name="message">通知内容</param>
    /// <param name="priority">优先级</param>
    /// <returns>发送是否成功</returns>
    private async Task<bool> SendViaChannelAsync(int notificationId, User user, string channel, string title, string message, string priority)
    {
        try
        {
            _logger.LogDebug("通过渠道 {Channel} 发送通知，通知ID: {NotificationId}，用户: {UserId}",
                channel, notificationId, user.Id);

            switch (channel.ToLower())
            {
                case "app":
                    return await SendAppNotificationAsync(notificationId, user, title, message, priority);
                case "sms":
                    return await SendSmsNotificationAsync(notificationId, user, title, message, priority);
                case "email":
                    return await SendEmailNotificationAsync(notificationId, user, title, message, priority);
                case "phone":
                    return await SendPhoneNotificationAsync(notificationId, user, title, message, priority);
                default:
                    _logger.LogWarning("不支持的通知渠道: {Channel}", channel);
                    return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "通过渠道 {Channel} 发送通知失败，通知ID: {NotificationId}", channel, notificationId);
            return false;
        }
    }

    /// <summary>
    /// 发送APP推送通知
    /// </summary>
    private async Task<bool> SendAppNotificationAsync(int notificationId, User user, string title, string message, string priority)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient("NotificationService");

            var request = new
            {
                userId = user.Id,
                username = user.Username,
                title,
                body = message,
                priority,
                notificationId
            };

            var response = await httpClient.PostAsJsonAsync("api/push/app", request);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("APP推送通知成功，通知ID: {NotificationId}，用户: {UserId}", notificationId, user.Id);
                await UpdateNotificationDeliveryAsync(notificationId);
                return true;
            }

            _logger.LogWarning("APP推送通知失败，状态码: {StatusCode}，通知ID: {NotificationId}",
                response.StatusCode, notificationId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "APP推送通知异常，通知ID: {NotificationId}", notificationId);
            return false;
        }
    }

    /// <summary>
    /// 发送短信通知
    /// </summary>
    private async Task<bool> SendSmsNotificationAsync(int notificationId, User user, string title, string message, string priority)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(user.Phone))
            {
                _logger.LogWarning("用户没有手机号码，无法发送短信，用户ID: {UserId}", user.Id);
                return false;
            }

            var httpClient = _httpClientFactory.CreateClient("NotificationService");

            var request = new
            {
                phone = user.Phone,
                content = $"【场馆管理系统】{title} - {message}",
                priority,
                notificationId
            };

            var response = await httpClient.PostAsJsonAsync("api/push/sms", request);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("短信通知发送成功，通知ID: {NotificationId}，用户: {UserId}", notificationId, user.Id);
                await UpdateNotificationDeliveryAsync(notificationId);
                return true;
            }

            _logger.LogWarning("短信通知发送失败，状态码: {StatusCode}，通知ID: {NotificationId}",
                response.StatusCode, notificationId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "短信通知发送异常，通知ID: {NotificationId}", notificationId);
            return false;
        }
    }

    /// <summary>
    /// 发送邮件通知
    /// </summary>
    private async Task<bool> SendEmailNotificationAsync(int notificationId, User user, string title, string message, string priority)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(user.Email))
            {
                _logger.LogWarning("用户没有邮箱地址，无法发送邮件，用户ID: {UserId}", user.Id);
                return false;
            }

            var httpClient = _httpClientFactory.CreateClient("NotificationService");

            var request = new
            {
                to = user.Email,
                toName = user.FullName,
                subject = title,
                body = message,
                priority,
                notificationId
            };

            var response = await httpClient.PostAsJsonAsync("api/push/email", request);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("邮件通知发送成功，通知ID: {NotificationId}，用户: {UserId}", notificationId, user.Id);
                await UpdateNotificationDeliveryAsync(notificationId);
                return true;
            }

            _logger.LogWarning("邮件通知发送失败，状态码: {StatusCode}，通知ID: {NotificationId}",
                response.StatusCode, notificationId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "邮件通知发送异常，通知ID: {NotificationId}", notificationId);
            return false;
        }
    }

    /// <summary>
    /// 发送电话通知
    /// </summary>
    private async Task<bool> SendPhoneNotificationAsync(int notificationId, User user, string title, string message, string priority)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(user.Phone))
            {
                _logger.LogWarning("用户没有手机号码，无法拨打电话，用户ID: {UserId}", user.Id);
                return false;
            }

            if (priority != "urgent")
            {
                _logger.LogDebug("非紧急通知，跳过电话渠道，通知ID: {NotificationId}", notificationId);
                return true;
            }

            var httpClient = _httpClientFactory.CreateClient("NotificationService");

            var request = new
            {
                phone = user.Phone,
                text = $"{title}。{message}",
                notificationId
            };

            var response = await httpClient.PostAsJsonAsync("api/push/phone", request);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("电话通知发起成功，通知ID: {NotificationId}，用户: {UserId}", notificationId, user.Id);
                await UpdateNotificationDeliveryAsync(notificationId);
                return true;
            }

            _logger.LogWarning("电话通知发起失败，状态码: {StatusCode}，通知ID: {NotificationId}",
                response.StatusCode, notificationId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "电话通知发送异常，通知ID: {NotificationId}", notificationId);
            return false;
        }
    }

    /// <summary>
    /// 更新通知送达时间
    /// </summary>
    /// <param name="notificationId">通知ID</param>
    private async Task UpdateNotificationDeliveryAsync(int notificationId)
    {
        try
        {
            var notification = await _context.Notifications.FindAsync(notificationId);
            if (notification != null)
            {
                notification.DeliveredAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                var cacheKey = $"{RedisKeyPrefix.Notification}status:{notificationId}";
                await _redis.KeyDeleteAsync(cacheKey);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "更新通知送达时间失败，通知ID: {NotificationId}", notificationId);
        }
    }
}
