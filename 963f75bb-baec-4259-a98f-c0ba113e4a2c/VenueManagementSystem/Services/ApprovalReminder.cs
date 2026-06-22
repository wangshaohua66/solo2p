using Hangfire;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using VenueManagementSystem.Common;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 审批超时提醒任务
/// 实现 IJob 接口
/// 每5分钟检测审批超时
/// 对超过24小时未处理的审批发送催办通知
/// </summary>
[DisplayName("审批超时提醒任务")]
public class ApprovalReminder : IJob
{
    private readonly IApprovalService _approvalService;
    private readonly INotificationService _notificationService;
    private readonly IDatabase _redis;
    private readonly ILogger<ApprovalReminder> _logger;

    /// <summary>
    /// 初始化审批提醒任务
    /// </summary>
    /// <param name="approvalService">审批服务</param>
    /// <param name="notificationService">通知服务</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    public ApprovalReminder(
        IApprovalService approvalService,
        INotificationService notificationService,
        IDatabase redis,
        ILogger<ApprovalReminder> logger)
    {
        _approvalService = approvalService;
        _notificationService = notificationService;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 执行审批超时检查任务
    /// </summary>
    [DisplayName("检查审批超时并发送提醒")]
    public async Task ExecuteAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始执行审批超时提醒任务");

            var timeoutCount = await _approvalService.CheckApprovalTimeoutsAsync();

            var now = DateTime.UtcNow;
            await _redis.StringSetAsync(
                $"{RedisKeyPrefix.Event}lastReminderCheck",
                now.ToString("o"),
                TimeSpan.FromMinutes(10));

            if (timeoutCount > 0)
            {
                _logger.LogInformation(
                    "审批超时提醒任务完成，发送催办通知: {TimeoutCount}条，耗时: {Elapsed}ms",
                    timeoutCount,
                    stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogInformation(
                    "审批超时提醒任务完成，无超时审批，耗时: {Elapsed}ms",
                    stopwatch.ElapsedMilliseconds);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "审批超时提醒任务执行失败");
            throw;
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
