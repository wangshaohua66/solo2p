using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 审批流程服务实现类
/// 提供审批流程发起、审核、驳回、查询等功能
/// 实现三级审批状态机
/// </summary>
public class ApprovalService : IApprovalService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<ApprovalService> _logger;
    private readonly INotificationService _notificationService;
    private readonly IAuthService _authService;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化审批服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="notificationService">通知服务</param>
    /// <param name="authService">认证服务</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public ApprovalService(
        AppDbContext context,
        IDatabase redis,
        ILogger<ApprovalService> logger,
        INotificationService notificationService,
        IAuthService authService,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _notificationService = notificationService;
        _authService = authService;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步获取活动审批步骤列表
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <returns>审批步骤列表</returns>
    public async Task<IEnumerable<ApprovalStep>> GetApprovalStepsAsync(int eventId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取活动审批步骤，活动ID: {EventId}", eventId);

            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));

            var cacheKey = $"{RedisKeyPrefix.Event}approval:{eventId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedSteps = Newtonsoft.Json.JsonConvert.DeserializeObject<List<ApprovalStep>>(cachedData!);
                if (cachedSteps != null && cachedSteps.Any())
                {
                    _logger.LogInformation("从Redis缓存获取审批步骤成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedSteps.Count, stopwatch.ElapsedMilliseconds);
                    return cachedSteps;
                }
            }

            var steps = await _context.ApprovalSteps
                .AsNoTracking()
                .Where(s => s.EventId == eventId)
                .OrderBy(s => s.Id)
                .ToListAsync();

            if (steps.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(steps),
                    TimeSpan.FromMinutes(5));
            }

            _logger.LogInformation("从数据库获取审批步骤成功，共{Count}条，耗时: {Elapsed}ms",
                steps.Count, stopwatch.ElapsedMilliseconds);

            return steps;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取活动审批步骤失败，活动ID: {EventId}", eventId);
            throw new InvalidOperationException($"获取活动审批步骤失败，活动ID: {eventId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步批准审批步骤
    /// 实现三级审批状态机
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="userId">审批人ID</param>
    /// <param name="comments">审批意见</param>
    /// <returns>批准是否成功</returns>
    public async Task<bool> ApproveStepAsync(int eventId, int stepId, int userId, string comments)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始批准审批步骤，活动ID: {EventId}, 步骤ID: {StepId}, 审批人ID: {UserId}",
                eventId, stepId, userId);

            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));
            if (stepId <= 0)
                throw new ArgumentException("步骤ID必须大于0", nameof(stepId));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var hasPermission = await _authService.ValidatePermissionAsync(userId, "Approval.Approve");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有审批权限");

            var step = await _context.ApprovalSteps
                .Include(s => s.EventItem)
                .FirstOrDefaultAsync(s => s.Id == stepId && s.EventId == eventId);

            if (step == null)
            {
                _logger.LogWarning("审批步骤不存在，活动ID: {EventId}, 步骤ID: {StepId}", eventId, stepId);
                return false;
            }

            if (step.Status != "InProgress")
            {
                _logger.LogWarning("审批步骤状态不允许批准，步骤ID: {StepId}, 状态: {Status}", stepId, step.Status);
                throw new InvalidOperationException("只有进行中的审批步骤可以批准");
            }

            var user = await _authService.GetCurrentUserAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("审批用户不存在，用户ID: {UserId}", userId);
                throw new InvalidOperationException("审批用户不存在");
            }

            if (!string.Equals(step.AssignedTo, user.Role, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("用户角色不匹配，需要角色: {RequiredRole}, 用户角色: {UserRole}",
                    step.AssignedTo, user.Role);
                throw new UnauthorizedAccessException($"此步骤需要 {step.AssignedTo} 角色审批");
            }

            step.Status = "Approved";
            step.Comments = comments;
            step.CompletedAt = DateTime.UtcNow;

            var allSteps = await _context.ApprovalSteps
                .Where(s => s.EventId == eventId)
                .OrderBy(s => s.Id)
                .ToListAsync();

            var currentIndex = allSteps.FindIndex(s => s.Id == stepId);
            var allApproved = allSteps.All(s => s.Status == "Approved");

            if (allApproved)
            {
                if (step.EventItem != null)
                {
                    step.EventItem.Status = nameof(EventStatus.Approved);
                }

                await _notificationService.BroadcastNotificationAsync(
                    new[] { "VenueManager", "Scheduler", "EventCoordinator" },
                    "活动审批通过",
                    $"活动 '{step.EventItem?.Name}' 已通过全部审批",
                    "high");
            }
            else if (currentIndex < allSteps.Count - 1)
            {
                var nextStep = allSteps[currentIndex + 1];
                nextStep.Status = "InProgress";
                nextStep.DueDate = DateTime.UtcNow.AddHours(24);

                await _notificationService.BroadcastNotificationAsync(
                    new[] { nextStep.AssignedTo },
                    "待审批通知",
                    $"活动 '{step.EventItem?.Name}' 等待您的审批",
                    "high");
            }

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearApprovalCache(eventId);

                if (step.EventItem != null)
                {
                    await _redisPublisher.PublishScheduleUpdateAsync(step.EventItem.VenueId, new
                    {
                        type = "ApprovalStepCompleted",
                        eventId = eventId,
                        stepId = stepId,
                        stepName = step.StepName,
                        status = "Approved",
                        approvedBy = userId,
                        approvedAt = DateTime.UtcNow,
                        allApproved = allApproved
                    });
                }

                _logger.LogInformation("批准审批步骤成功，活动ID: {EventId}, 步骤ID: {StepId}，耗时: {Elapsed}ms",
                    eventId, stepId, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                await transaction.RollbackAsync();
            }

            return result;
        }
        catch (ArgumentException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "批准审批步骤失败，活动ID: {EventId}, 步骤ID: {StepId}", eventId, stepId);
            throw new InvalidOperationException($"批准审批步骤失败，步骤ID: {stepId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步驳回审批步骤
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="userId">审批人ID</param>
    /// <param name="comments">驳回原因</param>
    /// <returns>驳回是否成功</returns>
    public async Task<bool> RejectStepAsync(int eventId, int stepId, int userId, string comments)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始驳回审批步骤，活动ID: {EventId}, 步骤ID: {StepId}, 审批人ID: {UserId}",
                eventId, stepId, userId);

            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));
            if (stepId <= 0)
                throw new ArgumentException("步骤ID必须大于0", nameof(stepId));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));
            if (string.IsNullOrWhiteSpace(comments))
                throw new ArgumentException("驳回原因不能为空", nameof(comments));

            var hasPermission = await _authService.ValidatePermissionAsync(userId, "Approval.Reject");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有驳回权限");

            var step = await _context.ApprovalSteps
                .Include(s => s.EventItem)
                .FirstOrDefaultAsync(s => s.Id == stepId && s.EventId == eventId);

            if (step == null)
            {
                _logger.LogWarning("审批步骤不存在，活动ID: {EventId}, 步骤ID: {StepId}", eventId, stepId);
                return false;
            }

            if (step.Status != "InProgress")
            {
                _logger.LogWarning("审批步骤状态不允许驳回，步骤ID: {StepId}, 状态: {Status}", stepId, step.Status);
                throw new InvalidOperationException("只有进行中的审批步骤可以驳回");
            }

            var user = await _authService.GetCurrentUserAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("审批用户不存在，用户ID: {UserId}", userId);
                throw new InvalidOperationException("审批用户不存在");
            }

            if (!string.Equals(step.AssignedTo, user.Role, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("用户角色不匹配，需要角色: {RequiredRole}, 用户角色: {UserRole}",
                    step.AssignedTo, user.Role);
                throw new UnauthorizedAccessException($"此步骤需要 {step.AssignedTo} 角色审批");
            }

            step.Status = "Rejected";
            step.Comments = comments;
            step.CompletedAt = DateTime.UtcNow;

            if (step.EventItem != null)
            {
                step.EventItem.Status = nameof(EventStatus.Rejected);

                var allSteps = await _context.ApprovalSteps
                    .Where(s => s.EventId == eventId)
                    .ToListAsync();

                foreach (var s in allSteps)
                {
                    if (s.Id != stepId && s.Status == "Pending")
                    {
                        s.Status = "Cancelled";
                    }
                }
            }

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearApprovalCache(eventId);

                if (step.EventItem != null)
                {
                    await _notificationService.SendNotificationAsync(
                        Convert.ToInt32(step.EventItem.CreatedBy),
                        "活动被驳回",
                        $"您的活动 '{step.EventItem.Name}' 被驳回，原因: {comments}",
                        "app",
                        "high");

                    await _redisPublisher.PublishScheduleUpdateAsync(step.EventItem.VenueId, new
                    {
                        type = "ApprovalStepRejected",
                        eventId = eventId,
                        stepId = stepId,
                        stepName = step.StepName,
                        status = "Rejected",
                        rejectedBy = userId,
                        rejectedAt = DateTime.UtcNow,
                        comments = comments
                    });
                }

                _logger.LogInformation("驳回审批步骤成功，活动ID: {EventId}, 步骤ID: {StepId}，耗时: {Elapsed}ms",
                    eventId, stepId, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                await transaction.RollbackAsync();
            }

            return result;
        }
        catch (ArgumentException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "驳回审批步骤失败，活动ID: {EventId}, 步骤ID: {StepId}", eventId, stepId);
            throw new InvalidOperationException($"驳回审批步骤失败，步骤ID: {stepId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取待我审批的列表
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>待审批列表</returns>
    public async Task<IEnumerable<ApprovalStep>> GetPendingApprovalsAsync(int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取待审批列表，用户ID: {UserId}", userId);

            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var user = await _authService.GetCurrentUserAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("用户不存在，用户ID: {UserId}", userId);
                return Enumerable.Empty<ApprovalStep>();
            }

            var cacheKey = $"{RedisKeyPrefix.Event}pending:{user.Role}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedSteps = Newtonsoft.Json.JsonConvert.DeserializeObject<List<ApprovalStep>>(cachedData!);
                if (cachedSteps != null)
                {
                    _logger.LogInformation("从Redis缓存获取待审批列表成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedSteps.Count, stopwatch.ElapsedMilliseconds);
                    return cachedSteps;
                }
            }

            var steps = await _context.ApprovalSteps
                .AsNoTracking()
                .Include(s => s.EventItem)
                .Where(s => s.AssignedTo == user.Role && s.Status == "InProgress")
                .OrderBy(s => s.DueDate)
                .ToListAsync();

            if (steps.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(steps),
                    TimeSpan.FromMinutes(3));
            }

            _logger.LogInformation("从数据库获取待审批列表成功，共{Count}条，耗时: {Elapsed}ms",
                steps.Count, stopwatch.ElapsedMilliseconds);

            return steps;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取待审批列表失败，用户ID: {UserId}", userId);
            throw new InvalidOperationException($"获取待审批列表失败，用户ID: {userId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步检测审批超时
    /// 对超过24小时未处理的审批发送催办通知
    /// </summary>
    /// <returns>超时审批数量</returns>
    public async Task<int> CheckApprovalTimeoutsAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var timeoutCount = 0;
        try
        {
            _logger.LogInformation("开始检测审批超时");

            var timeoutThreshold = DateTime.UtcNow.AddHours(-24);
            var timeoutSteps = await _context.ApprovalSteps
                .AsNoTracking()
                .Include(s => s.EventItem)
                .Where(s => s.Status == "InProgress" && s.DueDate < timeoutThreshold)
                .OrderBy(s => s.DueDate)
                .ToListAsync();

            if (!timeoutSteps.Any())
            {
                _logger.LogInformation("未检测到超时审批，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                return 0;
            }

            timeoutCount = timeoutSteps.Count;
            var tasks = new List<Task>();

            foreach (var step in timeoutSteps)
            {
                var task = _notificationService.BroadcastNotificationAsync(
                    new[] { step.AssignedTo },
                    "审批超时催办",
                    $"活动 '{step.EventItem?.Name}' 的审批步骤 '{step.StepName}' 已超时，请尽快处理",
                    "urgent");
                tasks.Add(task);

                var reminderKey = $"{RedisKeyPrefix.Event}reminder:{step.Id}";
                var lastReminder = await _redis.StringGetAsync(reminderKey);
                if (!lastReminder.HasValue ||
                    DateTime.TryParse(lastReminder, out var lastTime) &&
                    (DateTime.UtcNow - lastTime).TotalHours >= 4)
                {
                    await _redis.StringSetAsync(reminderKey, DateTime.UtcNow.ToString(), TimeSpan.FromHours(4));
                }
            }

            await Task.WhenAll(tasks);

            _logger.LogInformation("检测审批超时完成，共{Count}条超时审批已发送催办通知，耗时: {Elapsed}ms",
                timeoutCount, stopwatch.ElapsedMilliseconds);

            return timeoutCount;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "检测审批超时失败");
            throw new InvalidOperationException("检测审批超时失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 清除审批相关缓存
    /// </summary>
    /// <param name="eventId">活动ID</param>
    private async Task ClearApprovalCache(int eventId)
    {
        try
        {
            var keys = new[]
            {
                $"{RedisKeyPrefix.Event}approval:{eventId}",
                $"{RedisKeyPrefix.Event}pending:Scheduler",
                $"{RedisKeyPrefix.Event}pending:VenueManager",
                $"{RedisKeyPrefix.Event}pending:Admin"
            };

            foreach (var key in keys)
            {
                await _redis.KeyDeleteAsync(key);
            }

            _logger.LogInformation("已清除审批相关缓存，活动ID: {EventId}", eventId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "清除审批缓存失败，活动ID: {EventId}", eventId);
        }
    }
}