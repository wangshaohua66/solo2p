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
/// 排期业务服务实现类
/// 调用ScheduleEngine进行冲突检测和排期
/// 管理排期锁定和确认流程
/// 发布排期变更消息
/// </summary>
public class ScheduleService : IScheduleService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<ScheduleService> _logger;
    private readonly IScheduleEngine _scheduleEngine;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化排期服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="scheduleEngine">排期引擎</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public ScheduleService(
        AppDbContext context,
        IDatabase redis,
        ILogger<ScheduleService> logger,
        IScheduleEngine scheduleEngine,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _scheduleEngine = scheduleEngine;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步获取场馆排期列表
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>排期列表</returns>
    public async Task<IEnumerable<ScheduleSlot>> GetSchedulesAsync(int venueId, DateTime startDate, DateTime endDate)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆排期列表，场馆ID: {VenueId}, 日期范围: {StartDate:yyyy-MM-dd} 至 {EndDate:yyyy-MM-dd}",
                venueId, startDate, endDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (startDate >= endDate)
                throw new ArgumentException("开始日期必须早于结束日期", nameof(startDate));

            var cacheKey = $"{RedisKeyPrefix.Schedule}{venueId}:{startDate:yyyyMMdd}:{endDate:yyyyMMdd}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedSlots = Newtonsoft.Json.JsonConvert.DeserializeObject<List<ScheduleSlot>>(cachedData!);
                if (cachedSlots != null && cachedSlots.Any())
                {
                    _logger.LogInformation("从Redis缓存获取排期列表成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedSlots.Count, stopwatch.ElapsedMilliseconds);
                    return cachedSlots;
                }
            }

            var slots = await _context.ScheduleSlots
                .AsNoTracking()
                .Where(s => s.VenueId == venueId &&
                            s.StartTime >= startDate &&
                            s.EndTime <= endDate)
                .Include(s => s.EventItem)
                .Include(s => s.Resource)
                .OrderBy(s => s.StartTime)
                .ThenBy(s => s.ResourceId)
                .ToListAsync();

            if (slots.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(slots),
                    TimeSpan.FromMinutes(15));
            }

            _logger.LogInformation("从数据库获取排期列表成功，共{Count}条，耗时: {Elapsed}ms",
                slots.Count, stopwatch.ElapsedMilliseconds);

            return slots;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆排期列表失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"获取场馆排期列表失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步创建排期
    /// </summary>
    /// <param name="schedule">排期信息</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>创建的排期</returns>
    public async Task<ScheduleSlot> CreateScheduleAsync(ScheduleSlot schedule, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始创建排期，场馆ID: {VenueId}, 资源ID: {ResourceId}, 时间: {StartTime:yyyy-MM-dd HH:mm} 至 {EndTime:yyyy-MM-dd HH:mm}",
                schedule?.VenueId, schedule?.ResourceId, schedule?.StartTime, schedule?.EndTime);

            if (schedule == null)
                throw new ArgumentNullException(nameof(schedule));
            if (schedule.VenueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(schedule));
            if (schedule.ResourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(schedule));
            if (schedule.StartTime >= schedule.EndTime)
                throw new ArgumentException("开始时间必须早于结束时间", nameof(schedule));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var conflictResult = await CheckConflictsAsync(schedule);
            if (conflictResult.TryGetValue("hasConflicts", out var hasConflicts) &&
                Convert.ToBoolean(hasConflicts))
            {
                var conflictCount = conflictResult.TryGetValue("conflictCount", out var count) ? count : 0;
                _logger.LogWarning("排期存在冲突，共{Count}个冲突", conflictCount);
                throw new InvalidOperationException($"排期存在 {conflictCount} 个冲突，请调整时间或资源");
            }

            schedule.IsLocked = true;
            schedule.LockExpiresAt = DateTime.UtcNow.AddDays(7);

            _context.ScheduleSlots.Add(schedule);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            await ClearScheduleCache(schedule.VenueId);

            await _scheduleEngine.LockScheduleAsync(schedule, 7);

            await _redisPublisher.PublishScheduleUpdateAsync(schedule.VenueId, new
            {
                type = "ScheduleCreated",
                slotId = schedule.Id,
                venueId = schedule.VenueId,
                resourceId = schedule.ResourceId,
                eventId = schedule.EventId,
                startTime = schedule.StartTime,
                endTime = schedule.EndTime,
                createdBy = userId,
                createdAt = DateTime.UtcNow
            });

            _logger.LogInformation("创建排期成功，排期ID: {SlotId}，耗时: {Elapsed}ms",
                schedule.Id, stopwatch.ElapsedMilliseconds);

            return schedule;
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
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "创建排期失败，场馆ID: {VenueId}", schedule?.VenueId);
            throw new InvalidOperationException("创建排期失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步更新排期
    /// </summary>
    /// <param name="schedule">排期信息</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>更新是否成功</returns>
    public async Task<bool> UpdateScheduleAsync(ScheduleSlot schedule, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始更新排期，排期ID: {SlotId}", schedule?.Id);

            if (schedule == null)
                throw new ArgumentNullException(nameof(schedule));
            if (schedule.Id <= 0)
                throw new ArgumentException("排期ID必须大于0", nameof(schedule));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var existingSlot = await _context.ScheduleSlots
                .FirstOrDefaultAsync(s => s.Id == schedule.Id);

            if (existingSlot == null)
            {
                _logger.LogWarning("排期不存在，排期ID: {SlotId}", schedule.Id);
                return false;
            }

            var conflictResult = await CheckConflictsAsync(schedule);
            if (conflictResult.TryGetValue("hasConflicts", out var hasConflicts) &&
                Convert.ToBoolean(hasConflicts))
            {
                var conflictCount = conflictResult.TryGetValue("conflictCount", out var count) ? count : 0;
                _logger.LogWarning("更新排期存在冲突，共{Count}个冲突", conflictCount);
                throw new InvalidOperationException($"排期存在 {conflictCount} 个冲突，请调整时间或资源");
            }

            existingSlot.ResourceId = schedule.ResourceId;
            existingSlot.StartTime = schedule.StartTime;
            existingSlot.EndTime = schedule.EndTime;
            existingSlot.IsLocked = schedule.IsLocked;
            existingSlot.LockExpiresAt = schedule.LockExpiresAt;

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();
                await ClearScheduleCache(existingSlot.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(existingSlot.VenueId, new
                {
                    type = "ScheduleUpdated",
                    slotId = existingSlot.Id,
                    venueId = existingSlot.VenueId,
                    resourceId = existingSlot.ResourceId,
                    startTime = existingSlot.StartTime,
                    endTime = existingSlot.EndTime,
                    updatedBy = userId,
                    updatedAt = DateTime.UtcNow
                });

                _logger.LogInformation("更新排期成功，排期ID: {SlotId}，耗时: {Elapsed}ms",
                    schedule.Id, stopwatch.ElapsedMilliseconds);
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
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "更新排期失败，排期ID: {SlotId}", schedule?.Id);
            throw new InvalidOperationException($"更新排期失败，排期ID: {schedule?.Id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步删除排期
    /// </summary>
    /// <param name="id">排期ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>删除是否成功</returns>
    public async Task<bool> DeleteScheduleAsync(int id, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始删除排期，排期ID: {SlotId}", id);

            if (id <= 0)
                throw new ArgumentException("排期ID必须大于0", nameof(id));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var schedule = await _context.ScheduleSlots
                .FirstOrDefaultAsync(s => s.Id == id);

            if (schedule == null)
            {
                _logger.LogWarning("排期不存在，排期ID: {SlotId}", id);
                return false;
            }

            _context.ScheduleSlots.Remove(schedule);
            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();

                var lockKey = $"{RedisKeyPrefix.Lock}schedule:{schedule.VenueId}:{schedule.ResourceId}:{schedule.StartTime:yyyyMMddHHmm}";
                await _redis.KeyDeleteAsync(lockKey);

                await ClearScheduleCache(schedule.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(schedule.VenueId, new
                {
                    type = "ScheduleDeleted",
                    slotId = schedule.Id,
                    venueId = schedule.VenueId,
                    resourceId = schedule.ResourceId,
                    startTime = schedule.StartTime,
                    endTime = schedule.EndTime,
                    deletedBy = userId,
                    deletedAt = DateTime.UtcNow
                });

                _logger.LogInformation("删除排期成功，排期ID: {SlotId}，耗时: {Elapsed}ms",
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
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "删除排期失败，排期ID: {SlotId}", id);
            throw new InvalidOperationException($"删除排期失败，排期ID: {id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步确认排期
    /// </summary>
    /// <param name="id">排期ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>确认是否成功</returns>
    public async Task<bool> ConfirmScheduleAsync(int id, int userId)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始确认排期，排期ID: {SlotId}", id);

            if (id <= 0)
                throw new ArgumentException("排期ID必须大于0", nameof(id));
            if (userId <= 0)
                throw new ArgumentException("用户ID必须大于0", nameof(userId));

            var schedule = await _context.ScheduleSlots
                .FirstOrDefaultAsync(s => s.Id == id);

            if (schedule == null)
            {
                _logger.LogWarning("排期不存在，排期ID: {SlotId}", id);
                return false;
            }

            schedule.IsLocked = false;
            schedule.LockExpiresAt = null;

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();

                var lockKey = $"{RedisKeyPrefix.Lock}schedule:{schedule.VenueId}:{schedule.ResourceId}:{schedule.StartTime:yyyyMMddHHmm}";
                await _redis.KeyDeleteAsync(lockKey);

                await ClearScheduleCache(schedule.VenueId);

                await _redisPublisher.PublishScheduleUpdateAsync(schedule.VenueId, new
                {
                    type = "ScheduleConfirmed",
                    slotId = schedule.Id,
                    venueId = schedule.VenueId,
                    resourceId = schedule.ResourceId,
                    startTime = schedule.StartTime,
                    endTime = schedule.EndTime,
                    confirmedBy = userId,
                    confirmedAt = DateTime.UtcNow
                });

                _logger.LogInformation("确认排期成功，排期ID: {SlotId}，耗时: {Elapsed}ms",
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
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "确认排期失败，排期ID: {SlotId}", id);
            throw new InvalidOperationException($"确认排期失败，排期ID: {id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步检测排期冲突
    /// </summary>
    /// <param name="schedule">待检测排期</param>
    /// <returns>冲突检测结果</returns>
    public async Task<Dictionary<string, object>> CheckConflictsAsync(ScheduleSlot schedule)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始检测排期冲突，场馆ID: {VenueId}, 时间: {StartTime:yyyy-MM-dd HH:mm} 至 {EndTime:yyyy-MM-dd HH:mm}",
                schedule?.VenueId, schedule?.StartTime, schedule?.EndTime);

            if (schedule == null)
                throw new ArgumentNullException(nameof(schedule));

            var existingEvents = await _context.Events
                .AsNoTracking()
                .Where(e => e.VenueId == schedule.VenueId &&
                            e.Status != nameof(EventStatus.Cancelled) &&
                            e.Status != nameof(EventStatus.Rejected) &&
                            e.StartDate < schedule.EndTime &&
                            e.EndDate > schedule.StartTime)
                .ToListAsync();

            var tempEvent = new EventItem
            {
                Id = schedule.EventId,
                VenueId = schedule.VenueId,
                StartDate = schedule.StartTime,
                EndDate = schedule.EndTime,
                Type = "Temporary"
            };

            var result = await _scheduleEngine.DetectConflictsAsync(tempEvent, existingEvents);

            _logger.LogInformation("排期冲突检测完成，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentNullException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "检测排期冲突失败");
            throw new InvalidOperationException("检测排期冲突失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步发布排期变更消息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventData">变更数据</param>
    /// <returns>发布是否成功</returns>
    public async Task<bool> PublishScheduleUpdateAsync(int venueId, object eventData)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始发布排期变更消息，场馆ID: {VenueId}", venueId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (eventData == null)
                throw new ArgumentNullException(nameof(eventData));

            await _redisPublisher.PublishScheduleUpdateAsync(venueId, eventData);

            _logger.LogInformation("发布排期变更消息成功，场馆ID: {VenueId}，耗时: {Elapsed}ms",
                venueId, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (ArgumentNullException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "发布排期变更消息失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"发布排期变更消息失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 清除排期相关缓存
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    private async Task ClearScheduleCache(int venueId)
    {
        var pattern = $"{RedisKeyPrefix.Schedule}{venueId}:*";
        var server = _redis.Multiplexer.GetServer(_redis.Multiplexer.GetEndPoints().First());
        var keys = server.Keys(pattern: pattern).ToList();

        foreach (var key in keys)
        {
            await _redis.KeyDeleteAsync(key);
        }

        var pattern2 = $"{RedisKeyPrefix.Venue}stats:{venueId}:*";
        var keys2 = server.Keys(pattern: pattern2).ToList();

        foreach (var key in keys2)
        {
            await _redis.KeyDeleteAsync(key);
        }
    }
}
