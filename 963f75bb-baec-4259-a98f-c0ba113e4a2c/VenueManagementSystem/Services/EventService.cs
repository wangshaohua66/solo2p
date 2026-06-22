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
/// 赛事管理服务实现类
/// 提供活动创建、编辑、发布、取消等管理功能
/// 验证用户权限
/// </summary>
public class EventService : IEventService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<EventService> _logger;
    private readonly IAuthService _authService;
    private readonly IApprovalService _approvalService;
    private readonly IScheduleEngine _scheduleEngine;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化活动服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="authService">认证服务</param>
    /// <param name="approvalService">审批服务</param>
    /// <param name="scheduleEngine">排期引擎</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public EventService(
        AppDbContext context,
        IDatabase redis,
        ILogger<EventService> logger,
        IAuthService authService,
        IApprovalService approvalService,
        IScheduleEngine scheduleEngine,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _authService = authService;
        _approvalService = approvalService;
        _scheduleEngine = scheduleEngine;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步创建活动
    /// </summary>
    /// <param name="eventDto">活动数据</param>
    /// <param name="userId">创建人ID</param>
    /// <returns>创建的活动</returns>
    public async Task<EventItem> CreateEventAsync(EventItem eventDto, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始创建活动，活动名称: {EventName}, 创建人ID: {UserId}", eventDto?.Name, userId);

            if (eventDto == null)
                throw new ArgumentNullException(nameof(eventDto));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));
            if (string.IsNullOrWhiteSpace(eventDto.Name))
                throw new ArgumentException("活动名称不能为空", nameof(eventDto));
            if (eventDto.VenueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(eventDto));
            if (eventDto.StartDate >= eventDto.EndDate)
                throw new ArgumentException("活动开始时间必须早于结束时间", nameof(eventDto));

            var hasPermission = await ValidatePermissionAsync(eventDto.Id, userId, "Event.Create");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有创建活动的权限");

            var existingEvents = await _context.Events
                .AsNoTracking()
                .Where(e => e.VenueId == eventDto.VenueId &&
                            e.Status != nameof(EventStatus.Cancelled) &&
                            e.Status != nameof(EventStatus.Rejected) &&
                            e.StartDate < eventDto.EndDate &&
                            e.EndDate > eventDto.StartDate)
                .ToListAsync();

            var conflictResult = await _scheduleEngine.DetectConflictsAsync(eventDto, existingEvents);
            if (conflictResult.TryGetValue("hasConflicts", out var hasConflicts) &&
                Convert.ToBoolean(hasConflicts) &&
                conflictResult.TryGetValue("highPriorityConflictCount", out var highCount) &&
                Convert.ToInt32(highCount) > 0)
            {
                _logger.LogWarning("活动存在高优先级冲突，无法创建");
                throw new InvalidOperationException("活动存在时间或资源冲突，请调整后重试");
            }

            eventDto.Status = nameof(EventStatus.Draft);
            eventDto.CreatedBy = userId.ToString();
            eventDto.CreatedAt = DateTime.UtcNow;

            _context.Events.Add(eventDto);
            await _context.SaveChangesAsync();

            var approvalSteps = new List<ApprovalStep>
            {
                new()
                {
                    EventId = eventDto.Id,
                    StepName = "排期员审核",
                    AssignedTo = "Scheduler",
                    Status = "Pending",
                    DueDate = DateTime.UtcNow.AddHours(24),
                    Comments = string.Empty
                },
                new()
                {
                    EventId = eventDto.Id,
                    StepName = "场馆经理审核",
                    AssignedTo = "VenueManager",
                    Status = "Pending",
                    DueDate = DateTime.UtcNow.AddHours(48),
                    Comments = string.Empty
                },
                new()
                {
                    EventId = eventDto.Id,
                    StepName = "最终审批",
                    AssignedTo = "Admin",
                    Status = "Pending",
                    DueDate = DateTime.UtcNow.AddHours(72),
                    Comments = string.Empty
                }
            };

            _context.ApprovalSteps.AddRange(approvalSteps);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            await ClearEventCache(eventDto.VenueId);

            await _redisPublisher.PublishScheduleUpdateAsync(eventDto.VenueId, new
            {
                type = "EventCreated",
                eventId = eventDto.Id,
                eventName = eventDto.Name,
                venueId = eventDto.VenueId,
                startDate = eventDto.StartDate,
                endDate = eventDto.EndDate,
                createdBy = userId,
                createdAt = DateTime.UtcNow
            });

            _logger.LogInformation("创建活动成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                eventDto.Id, stopwatch.ElapsedMilliseconds);

            return eventDto;
        }
        catch (ArgumentNullException)
        {
            await transaction.RollbackAsync();
            throw;
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
            _logger.LogError(ex, "创建活动失败，活动名称: {EventName}", eventDto?.Name);
            throw new InvalidOperationException("创建活动失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步更新活动
    /// </summary>
    /// <param name="eventDto">活动数据</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>更新是否成功</returns>
    public async Task<bool> UpdateEventAsync(EventItem eventDto, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始更新活动，活动ID: {EventId}, 操作人ID: {UserId}", eventDto?.Id, userId);

            if (eventDto == null)
                throw new ArgumentNullException(nameof(eventDto));
            if (eventDto.Id <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventDto));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var hasPermission = await ValidatePermissionAsync(eventDto.Id, userId, "Event.Edit");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有编辑此活动的权限");

            var existingEvent = await _context.Events
                .FirstOrDefaultAsync(e => e.Id == eventDto.Id);

            if (existingEvent == null)
            {
                _logger.LogWarning("活动不存在，活动ID: {EventId}", eventDto.Id);
                return false;
            }

            if (existingEvent.Status == nameof(EventStatus.Approved) ||
                existingEvent.Status == nameof(EventStatus.Scheduled) ||
                existingEvent.Status == nameof(EventStatus.InProgress))
            {
                _logger.LogWarning("活动状态不允许编辑，活动ID: {EventId}, 状态: {Status}", eventDto.Id, existingEvent.Status);
                throw new InvalidOperationException("已批准或已排期的活动不允许编辑");
            }

            if (existingEvent.StartDate != eventDto.StartDate ||
                existingEvent.EndDate != eventDto.EndDate ||
                existingEvent.VenueId != eventDto.VenueId)
            {
                var existingEvents = await _context.Events
                    .AsNoTracking()
                    .Where(e => e.VenueId == eventDto.VenueId &&
                                e.Id != eventDto.Id &&
                                e.Status != nameof(EventStatus.Cancelled) &&
                                e.Status != nameof(EventStatus.Rejected) &&
                                e.StartDate < eventDto.EndDate &&
                                e.EndDate > eventDto.StartDate)
                    .ToListAsync();

                var conflictResult = await _scheduleEngine.DetectConflictsAsync(eventDto, existingEvents);
                if (conflictResult.TryGetValue("hasConflicts", out var hasConflicts) &&
                    Convert.ToBoolean(hasConflicts) &&
                    conflictResult.TryGetValue("highPriorityConflictCount", out var highCount) &&
                    Convert.ToInt32(highCount) > 0)
                {
                    _logger.LogWarning("活动更新存在高优先级冲突，无法更新");
                    throw new InvalidOperationException("活动存在时间或资源冲突，请调整后重试");
                }
            }

            existingEvent.Name = eventDto.Name;
            existingEvent.Type = eventDto.Type;
            existingEvent.Description = eventDto.Description;
            existingEvent.VenueId = eventDto.VenueId;
            existingEvent.StartDate = eventDto.StartDate;
            existingEvent.EndDate = eventDto.EndDate;
            existingEvent.ExpectedRevenue = eventDto.ExpectedRevenue;
            existingEvent.Status = nameof(EventStatus.Draft);

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearEventCache(existingEvent.VenueId);
                await ClearEventCache(eventDto.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(existingEvent.VenueId, new
                {
                    type = "EventUpdated",
                    eventId = existingEvent.Id,
                    eventName = existingEvent.Name,
                    venueId = existingEvent.VenueId,
                    startDate = existingEvent.StartDate,
                    endDate = existingEvent.EndDate,
                    updatedBy = userId,
                    updatedAt = DateTime.UtcNow
                });

                _logger.LogInformation("更新活动成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                    eventDto.Id, stopwatch.ElapsedMilliseconds);
            }
            else
            {
                await transaction.RollbackAsync();
            }

            return result;
        }
        catch (ArgumentNullException)
        {
            await transaction.RollbackAsync();
            throw;
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
            _logger.LogError(ex, "更新活动失败，活动ID: {EventId}", eventDto?.Id);
            throw new InvalidOperationException($"更新活动失败，活动ID: {eventDto?.Id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取活动列表
    /// </summary>
    /// <param name="filter">过滤条件</param>
    /// <returns>活动列表</returns>
    public async Task<IEnumerable<EventItem>> GetEventsAsync(Dictionary<string, object>? filter = null)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取活动列表");

            var cacheKey = $"{RedisKeyPrefix.Event}list";
            if (filter != null && filter.Any())
            {
                var filterStr = string.Join("|", filter.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}:{kv.Value}"));
                cacheKey = $"{RedisKeyPrefix.Event}list:{filterStr.GetHashCode()}";
            }

            var cachedData = await _redis.StringGetAsync(cacheKey);
            if (cachedData.HasValue)
            {
                var cachedEvents = Newtonsoft.Json.JsonConvert.DeserializeObject<List<EventItem>>(cachedData!);
                if (cachedEvents != null && cachedEvents.Any())
                {
                    _logger.LogInformation("从Redis缓存获取活动列表成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedEvents.Count, stopwatch.ElapsedMilliseconds);
                    return cachedEvents;
                }
            }

            var query = _context.Events
                .AsNoTracking()
                .Include(e => e.Venue)
                .Include(e => e.ApprovalSteps)
                .AsQueryable();

            if (filter != null)
            {
                if (filter.TryGetValue("venueId", out var venueIdObj) && venueIdObj != null)
                {
                    var venueId = Convert.ToInt32(venueIdObj);
                    query = query.Where(e => e.VenueId == venueId);
                }

                if (filter.TryGetValue("status", out var statusObj) && statusObj != null)
                {
                    var status = statusObj.ToString();
                    if (!string.IsNullOrWhiteSpace(status))
                    {
                        query = query.Where(e => e.Status == status);
                    }
                }

                if (filter.TryGetValue("type", out var typeObj) && typeObj != null)
                {
                    var type = typeObj.ToString();
                    if (!string.IsNullOrWhiteSpace(type))
                    {
                        query = query.Where(e => e.Type == type);
                    }
                }

                if (filter.TryGetValue("startDate", out var startDateObj) && startDateObj != null)
                {
                    var startDate = Convert.ToDateTime(startDateObj);
                    query = query.Where(e => e.StartDate >= startDate);
                }

                if (filter.TryGetValue("endDate", out var endDateObj) && endDateObj != null)
                {
                    var endDate = Convert.ToDateTime(endDateObj);
                    query = query.Where(e => e.EndDate <= endDate);
                }

                if (filter.TryGetValue("createdBy", out var createdByObj) && createdByObj != null)
                {
                    var createdBy = createdByObj.ToString();
                    if (!string.IsNullOrWhiteSpace(createdBy))
                    {
                        query = query.Where(e => e.CreatedBy == createdBy);
                    }
                }
            }

            var events = await query
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            if (events.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(events),
                    TimeSpan.FromMinutes(10));
            }

            _logger.LogInformation("从数据库获取活动列表成功，共{Count}条，耗时: {Elapsed}ms",
                events.Count, stopwatch.ElapsedMilliseconds);

            return events;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取活动列表失败");
            throw new InvalidOperationException("获取活动列表失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步根据ID获取活动
    /// </summary>
    /// <param name="id">活动ID</param>
    /// <returns>活动信息，不存在返回null</returns>
    public async Task<EventItem?> GetEventByIdAsync(int id)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取活动信息，活动ID: {EventId}", id);

            if (id <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(id));

            var cacheKey = $"{RedisKeyPrefix.Event}{id}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取活动信息成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                    id, stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<EventItem>(cachedData!);
            }

            var eventItem = await _context.Events
                .AsNoTracking()
                .Include(e => e.Venue)
                .Include(e => e.ScheduleSlots)
                    .ThenInclude(s => s.Resource)
                .Include(e => e.ApprovalSteps)
                .Include(e => e.TicketSales)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (eventItem != null)
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(eventItem),
                    TimeSpan.FromMinutes(15));
            }

            _logger.LogInformation("从数据库获取活动信息成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                id, stopwatch.ElapsedMilliseconds);

            return eventItem;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取活动信息失败，活动ID: {EventId}", id);
            throw new InvalidOperationException($"获取活动信息失败，活动ID: {id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步删除活动
    /// </summary>
    /// <param name="id">活动ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>删除是否成功</returns>
    public async Task<bool> DeleteEventAsync(int id, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始删除活动，活动ID: {EventId}, 操作人ID: {UserId}", id, userId);

            if (id <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(id));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var hasPermission = await ValidatePermissionAsync(id, userId, "Event.Delete");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有删除此活动的权限");

            var eventItem = await _context.Events
                .Include(e => e.ScheduleSlots)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (eventItem == null)
            {
                _logger.LogWarning("活动不存在，活动ID: {EventId}", id);
                return false;
            }

            if (eventItem.Status == nameof(EventStatus.InProgress) ||
                eventItem.Status == nameof(EventStatus.Completed))
            {
                _logger.LogWarning("活动状态不允许删除，活动ID: {EventId}, 状态: {Status}", id, eventItem.Status);
                throw new InvalidOperationException("进行中或已完成的活动不允许删除");
            }

            eventItem.Status = nameof(EventStatus.Cancelled);

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearEventCache(eventItem.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(eventItem.VenueId, new
                {
                    type = "EventCancelled",
                    eventId = eventItem.Id,
                    eventName = eventItem.Name,
                    venueId = eventItem.VenueId,
                    cancelledBy = userId,
                    cancelledAt = DateTime.UtcNow
                });

                _logger.LogInformation("删除活动成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                    id, stopwatch.ElapsedMilliseconds);
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
            _logger.LogError(ex, "删除活动失败，活动ID: {EventId}", id);
            throw new InvalidOperationException($"删除活动失败，活动ID: {id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步提交审批
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>提交是否成功</returns>
    public async Task<bool> SubmitForApprovalAsync(int eventId, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始提交活动审批，活动ID: {EventId}, 操作人ID: {UserId}", eventId, userId);

            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var hasPermission = await ValidatePermissionAsync(eventId, userId, "Event.Submit");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有提交此活动审批的权限");

            var eventItem = await _context.Events
                .Include(e => e.ApprovalSteps)
                .FirstOrDefaultAsync(e => e.Id == eventId);

            if (eventItem == null)
            {
                _logger.LogWarning("活动不存在，活动ID: {EventId}", eventId);
                return false;
            }

            if (eventItem.Status != nameof(EventStatus.Draft) &&
                eventItem.Status != nameof(EventStatus.Rejected))
            {
                _logger.LogWarning("活动状态不允许提交审批，活动ID: {EventId}, 状态: {Status}", eventId, eventItem.Status);
                throw new InvalidOperationException("只有草稿或已拒绝状态的活动可以提交审批");
            }

            eventItem.Status = nameof(EventStatus.PendingApproval);

            var firstStep = eventItem.ApprovalSteps
                .OrderBy(s => s.Id)
                .FirstOrDefault();

            if (firstStep != null)
            {
                firstStep.Status = "InProgress";
                firstStep.DueDate = DateTime.UtcNow.AddHours(24);
            }

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearEventCache(eventItem.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(eventItem.VenueId, new
                {
                    type = "EventSubmitted",
                    eventId = eventItem.Id,
                    eventName = eventItem.Name,
                    venueId = eventItem.VenueId,
                    submittedBy = userId,
                    submittedAt = DateTime.UtcNow
                });

                _logger.LogInformation("提交活动审批成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                    eventId, stopwatch.ElapsedMilliseconds);
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
            _logger.LogError(ex, "提交活动审批失败，活动ID: {EventId}", eventId);
            throw new InvalidOperationException($"提交活动审批失败，活动ID: {eventId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 验证用户是否有权限操作指定活动
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="userId">用户ID</param>
    /// <param name="permission">所需权限</param>
    /// <returns>是否有权限</returns>
    public async Task<bool> ValidatePermissionAsync(int eventId, int userId, string permission)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始验证用户权限，活动ID: {EventId}, 用户ID: {UserId}, 权限: {Permission}",
                eventId, userId, permission);

            var hasSystemPermission = await _authService.ValidatePermissionAsync(userId, permission);
            if (hasSystemPermission)
            {
                _logger.LogInformation("用户拥有系统级权限，用户ID: {UserId}, 权限: {Permission}，耗时: {Elapsed}ms",
                    userId, permission, stopwatch.ElapsedMilliseconds);
                return true;
            }

            if (eventId > 0)
            {
                var eventItem = await _context.Events
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.Id == eventId);

                if (eventItem != null && eventItem.CreatedBy == userId.ToString())
                {
                    _logger.LogInformation("用户是活动创建者，拥有操作权限，活动ID: {EventId}, 用户ID: {UserId}，耗时: {Elapsed}ms",
                        eventId, userId, stopwatch.ElapsedMilliseconds);
                    return true;
                }
            }

            _logger.LogWarning("用户没有操作权限，活动ID: {EventId}, 用户ID: {UserId}, 权限: {Permission}，耗时: {Elapsed}ms",
                eventId, userId, permission, stopwatch.ElapsedMilliseconds);

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "验证用户权限失败，用户ID: {UserId}", userId);
            throw new InvalidOperationException("验证用户权限失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 清除活动相关缓存
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    private async Task ClearEventCache(int venueId)
    {
        var server = _redis.Multiplexer.GetServer(_redis.Multiplexer.GetEndPoints().First());

        var eventKeys = server.Keys(pattern: $"{RedisKeyPrefix.Event}*").ToList();
        foreach (var key in eventKeys)
        {
            await _redis.KeyDeleteAsync(key);
        }

        var scheduleKeys = server.Keys(pattern: $"{RedisKeyPrefix.Schedule}{venueId}:*").ToList();
        foreach (var key in scheduleKeys)
        {
            await _redis.KeyDeleteAsync(key);
        }

        var statsKeys = server.Keys(pattern: $"{RedisKeyPrefix.Venue}stats:{venueId}:*").ToList();
        foreach (var key in statsKeys)
        {
            await _redis.KeyDeleteAsync(key);
        }
    }
}
