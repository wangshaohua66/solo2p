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
/// 档期引擎实现类
/// 基于Redis的排期算法与冲突仲裁
/// 性能要求：冲突检测 < 500ms
/// </summary>
public class ScheduleEngine : IScheduleEngine
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<ScheduleEngine> _logger;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化排期引擎
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public ScheduleEngine(
        AppDbContext context,
        IDatabase redis,
        ILogger<ScheduleEngine> logger,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步检测排期冲突
    /// 检测档期重叠、资源冲突、设备模式冲突
    /// 性能要求：冲突检测 < 500ms
    /// </summary>
    /// <param name="newEvent">新活动信息</param>
    /// <param name="existingEvents">现有活动列表</param>
    /// <returns>冲突检测结果，包含冲突类型和详细信息</returns>
    public async Task<Dictionary<string, object>> DetectConflictsAsync(EventItem newEvent, IEnumerable<EventItem> existingEvents)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始检测排期冲突，活动: {EventName}, 时间: {StartDate:yyyy-MM-dd HH:mm} 至 {EndDate:yyyy-MM-dd HH:mm}",
                newEvent.Name, newEvent.StartDate, newEvent.EndDate);

            if (newEvent == null)
                throw new ArgumentNullException(nameof(newEvent));
            if (newEvent.StartDate >= newEvent.EndDate)
                throw new ArgumentException("活动开始时间必须早于结束时间", nameof(newEvent));

            var result = new Dictionary<string, object>
            {
                ["hasConflicts"] = false,
                ["conflicts"] = new List<Dictionary<string, object>>(),
                ["detectionTimeMs"] = 0
            };

            var conflicts = new List<Dictionary<string, object>>();

            var cacheKey = $"{RedisKeyPrefix.Schedule}conflicts:{newEvent.VenueId}:{newEvent.StartDate:yyyyMMddHHmm}:{newEvent.EndDate:yyyyMMddHHmm}";
            var cachedResult = await _redis.StringGetAsync(cacheKey);

            if (cachedResult.HasValue)
            {
                var cached = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(cachedResult!);
                if (cached != null)
                {
                    _logger.LogInformation("从Redis缓存获取冲突检测结果，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                    return cached;
                }
            }

            var existingEventList = existingEvents.ToList();

            var overlappingEvents = existingEventList
                .Where(e => e.Id != newEvent.Id &&
                            e.StartDate < newEvent.EndDate &&
                            e.EndDate > newEvent.StartDate)
                .ToList();

            if (overlappingEvents.Any())
            {
                foreach (var ev in overlappingEvents)
                {
                    conflicts.Add(new Dictionary<string, object>
                    {
                        ["type"] = "ScheduleOverlap",
                        ["severity"] = "High",
                        ["conflictingEventId"] = ev.Id,
                        ["conflictingEventName"] = ev.Name,
                        ["overlapStart"] = newEvent.StartDate > ev.StartDate ? newEvent.StartDate : ev.StartDate,
                        ["overlapEnd"] = newEvent.EndDate < ev.EndDate ? newEvent.EndDate : ev.EndDate,
                        ["message"] = $"与活动 '{ev.Name}' 存在档期重叠"
                    });
                }
            }

            var newEventResourceIds = await _context.ScheduleSlots
                .AsNoTracking()
                .Where(s => s.EventId == newEvent.Id)
                .Select(s => s.ResourceId)
                .ToListAsync();

            if (newEventResourceIds.Any())
            {
                var overlappingEventIds = overlappingEvents.Select(e => e.Id).ToList();
                var conflictingResourceSlots = await _context.ScheduleSlots
                    .AsNoTracking()
                    .Where(s => overlappingEventIds.Contains(s.EventId) &&
                                newEventResourceIds.Contains(s.ResourceId) &&
                                s.StartTime < newEvent.EndDate &&
                                s.EndTime > newEvent.StartDate)
                    .Include(s => s.Resource)
                    .Include(s => s.EventItem)
                    .ToListAsync();

                foreach (var slot in conflictingResourceSlots)
                {
                    conflicts.Add(new Dictionary<string, object>
                    {
                        ["type"] = "ResourceConflict",
                        ["severity"] = "High",
                        ["resourceId"] = slot.ResourceId,
                        ["resourceName"] = slot.Resource?.Name ?? "Unknown",
                        ["conflictingEventId"] = slot.EventId,
                        ["conflictingEventName"] = slot.EventItem?.Name ?? "Unknown",
                        ["message"] = $"资源 '{slot.Resource?.Name}' 已被活动 '{slot.EventItem?.Name}' 占用"
                    });
                }
            }

            var venueEquipments = await _context.Equipments
                .AsNoTracking()
                .Where(e => e.VenueId == newEvent.VenueId)
                .ToListAsync();

            var eventType = newEvent.Type;
            var requiredEquipmentModes = GetRequiredEquipmentModes(eventType);

            foreach (var equipment in venueEquipments)
            {
                var supportedModes = equipment.ModeCompatibility.Split(',', StringSplitOptions.RemoveEmptyEntries);
                var modeConflict = requiredEquipmentModes
                    .Where(mode => !supportedModes.Contains(mode, StringComparer.OrdinalIgnoreCase))
                    .ToList();

                if (modeConflict.Any())
                {
                    conflicts.Add(new Dictionary<string, object>
                    {
                        ["type"] = "EquipmentModeConflict",
                        ["severity"] = "Medium",
                        ["equipmentId"] = equipment.Id,
                        ["equipmentName"] = equipment.Name,
                        ["requiredModes"] = modeConflict,
                        ["supportedModes"] = supportedModes,
                        ["message"] = $"设备 '{equipment.Name}' 不支持活动所需的模式: {string.Join(", ", modeConflict)}"
                    });
                }
            }

            var highPriorityConflicts = conflicts.Any(c => c["severity"].ToString() == "High");
            result["hasConflicts"] = conflicts.Any();
            result["conflicts"] = conflicts;
            result["conflictCount"] = conflicts.Count;
            result["highPriorityConflictCount"] = conflicts.Count(c => c["severity"].ToString() == "High");
            result["canProceed"] = !highPriorityConflicts;
            result["detectionTimeMs"] = stopwatch.ElapsedMilliseconds;

            if (stopwatch.ElapsedMilliseconds > 500)
            {
                _logger.LogWarning("冲突检测超过性能阈值，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
            }

            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(result),
                TimeSpan.FromSeconds(30));

            _logger.LogInformation("排期冲突检测完成，发现 {Count} 个冲突，耗时: {Elapsed}ms",
                conflicts.Count, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentNullException)
        {
            throw;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "排期冲突检测失败，活动: {EventName}", newEvent?.Name);
            throw new InvalidOperationException("排期冲突检测失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步查找最佳排期时段
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="duration">活动时长（分钟）</param>
    /// <param name="preferredDate">首选日期</param>
    /// <param name="requiredResources">所需资源ID列表</param>
    /// <returns>最佳排期建议</returns>
    public async Task<ScheduleSlot?> FindOptimalSlotAsync(int venueId, int duration, DateTime preferredDate, IEnumerable<int> requiredResources)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始查找最佳排期时段，场馆ID: {VenueId}, 时长: {Duration}分钟, 首选日期: {PreferredDate:yyyy-MM-dd}",
                venueId, duration, preferredDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (duration <= 0)
                throw new ArgumentException("活动时长必须大于0", nameof(duration));

            var resourceList = requiredResources.ToList();
            var searchStartDate = preferredDate.Date.AddHours(8);
            var searchEndDate = preferredDate.Date.AddDays(7).AddHours(22);

            var existingSlots = await _context.ScheduleSlots
                .AsNoTracking()
                .Where(s => s.VenueId == venueId &&
                            s.StartTime >= searchStartDate &&
                            s.EndTime <= searchEndDate &&
                            resourceList.Contains(s.ResourceId))
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            var workingHoursStart = 8;
            var workingHoursEnd = 22;

            for (var currentDate = preferredDate.Date; currentDate <= searchEndDate.Date; currentDate = currentDate.AddDays(1))
            {
                for (var hour = workingHoursStart; hour < workingHoursEnd; hour++)
                {
                    var candidateStart = currentDate.AddHours(hour);
                    var candidateEnd = candidateStart.AddMinutes(duration);

                    if (candidateEnd.Hour > workingHoursEnd ||
                        (candidateEnd.Hour == workingHoursEnd && candidateEnd.Minute > 0))
                        continue;

                    var hasConflict = existingSlots.Any(s =>
                        s.StartTime < candidateEnd && s.EndTime > candidateStart);

                    if (!hasConflict)
                    {
                        var optimalSlot = new ScheduleSlot
                        {
                            VenueId = venueId,
                            StartTime = candidateStart,
                            EndTime = candidateEnd,
                            ResourceId = resourceList.FirstOrDefault(),
                            IsLocked = false
                        };

                        _logger.LogInformation("找到最佳排期时段，场馆ID: {VenueId}, 时间: {StartTime:yyyy-MM-dd HH:mm} 至 {EndTime:yyyy-MM-dd HH:mm}, 耗时: {Elapsed}ms",
                            venueId, candidateStart, candidateEnd, stopwatch.ElapsedMilliseconds);

                        return optimalSlot;
                    }
                }
            }

            _logger.LogInformation("未找到可用排期时段，场馆ID: {VenueId}, 搜索范围: {StartDate:yyyy-MM-dd} 至 {EndDate:yyyy-MM-dd}, 耗时: {Elapsed}ms",
                venueId, searchStartDate, searchEndDate, stopwatch.ElapsedMilliseconds);

            return null;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "查找最佳排期时段失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"查找最佳排期时段失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步生成排期建议
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="duration">活动时长（分钟）</param>
    /// <param name="conflictDate">发生冲突的日期</param>
    /// <returns>替代日期和资源置换方案列表</returns>
    public async Task<IEnumerable<Dictionary<string, object>>> GenerateSuggestionsAsync(int venueId, int duration, DateTime conflictDate)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始生成排期建议，场馆ID: {VenueId}, 时长: {Duration}分钟, 冲突日期: {ConflictDate:yyyy-MM-dd}",
                venueId, duration, conflictDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (duration <= 0)
                throw new ArgumentException("活动时长必须大于0", nameof(duration));

            var suggestions = new List<Dictionary<string, object>>();

            var searchRangeStart = conflictDate.AddDays(-3);
            var searchRangeEnd = conflictDate.AddDays(7);

            var allResources = await _context.Resources
                .AsNoTracking()
                .Where(r => r.VenueId == venueId && r.Status == nameof(ResourceStatus.Available))
                .ToListAsync();

            var existingSlots = await _context.ScheduleSlots
                .AsNoTracking()
                .Where(s => s.VenueId == venueId &&
                            s.StartTime >= searchRangeStart &&
                            s.EndTime <= searchRangeEnd)
                .ToListAsync();

            for (var date = searchRangeStart.Date; date <= searchRangeEnd.Date; date = date.AddDays(1))
            {
                for (var hour = 8; hour < 22; hour++)
                {
                    var candidateStart = date.AddHours(hour);
                    var candidateEnd = candidateStart.AddMinutes(duration);

                    if (candidateEnd.Hour > 22) continue;

                    var conflicts = existingSlots
                        .Where(s => s.StartTime < candidateEnd && s.EndTime > candidateStart)
                        .ToList();

                    if (!conflicts.Any())
                    {
                        var suggestion = new Dictionary<string, object>
                        {
                            ["type"] = date.Date == conflictDate.Date ? "SameDayAlternative" : "DifferentDayAlternative",
                            ["suggestedDate"] = date,
                            ["startTime"] = candidateStart,
                            ["endTime"] = candidateEnd,
                            ["score"] = CalculateSuggestionScore(date, conflictDate, hour),
                            ["availableResources"] = allResources
                                .Where(r => !existingSlots.Any(s =>
                                    s.ResourceId == r.Id &&
                                    s.StartTime < candidateEnd &&
                                    s.EndTime > candidateStart))
                                .Select(r => new { r.Id, r.Name, r.Type })
                                .ToList(),
                            ["isPreferredDate"] = date.Date == conflictDate.Date
                        };

                        suggestions.Add(suggestion);
                    }
                    else
                    {
                        var conflictingResourceIds = conflicts.Select(c => c.ResourceId).ToHashSet();
                        var alternativeResources = allResources
                            .Where(r => !conflictingResourceIds.Contains(r.Id) &&
                                       !existingSlots.Any(s =>
                                           s.ResourceId == r.Id &&
                                           s.StartTime < candidateEnd &&
                                           s.EndTime > candidateStart))
                            .ToList();

                        if (alternativeResources.Any())
                        {
                            var suggestion = new Dictionary<string, object>
                            {
                                ["type"] = "ResourceReplacement",
                                ["suggestedDate"] = date,
                                ["startTime"] = candidateStart,
                                ["endTime"] = candidateEnd,
                                ["score"] = CalculateSuggestionScore(date, conflictDate, hour),
                                ["conflictingResources"] = conflicts
                                    .Select(c => new { c.ResourceId, c.EventId })
                                    .ToList(),
                                ["alternativeResources"] = alternativeResources
                                    .Select(r => new { r.Id, r.Name, r.Type })
                                    .ToList(),
                                ["isPreferredDate"] = date.Date == conflictDate.Date
                            };

                            suggestions.Add(suggestion);
                        }
                    }
                }
            }

            var topSuggestions = suggestions
                .OrderByDescending(s => Convert.ToDouble(s["score"]))
                .Take(10)
                .ToList();

            _logger.LogInformation("生成 {Count} 条排期建议，耗时: {Elapsed}ms",
                topSuggestions.Count, stopwatch.ElapsedMilliseconds);

            return topSuggestions;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "生成排期建议失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"生成排期建议失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步从Redis读取排期缓存
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>排期缓存数据</returns>
    public async Task<IEnumerable<ScheduleSlot>> GetScheduleCacheAsync(int venueId, DateTime startDate, DateTime endDate)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始从Redis读取排期缓存，场馆ID: {VenueId}, 日期范围: {StartDate:yyyy-MM-dd} 至 {EndDate:yyyy-MM-dd}",
                venueId, startDate, endDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (startDate >= endDate)
                throw new ArgumentException("开始日期必须早于结束日期", nameof(startDate));

            var cacheKey = $"{RedisKeyPrefix.Schedule}{venueId}:{startDate:yyyyMMdd}:{endDate:yyyyMMdd}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var slots = Newtonsoft.Json.JsonConvert.DeserializeObject<List<ScheduleSlot>>(cachedData!) ?? new List<ScheduleSlot>();
                _logger.LogInformation("从Redis缓存获取排期数据成功，共{Count}条，耗时: {Elapsed}ms",
                    slots.Count, stopwatch.ElapsedMilliseconds);
                return slots;
            }

            _logger.LogInformation("Redis缓存中未找到排期数据，场馆ID: {VenueId}, 耗时: {Elapsed}ms",
                venueId, stopwatch.ElapsedMilliseconds);

            return Enumerable.Empty<ScheduleSlot>();
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "从Redis读取排期缓存失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"从Redis读取排期缓存失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步更新Redis排期缓存
    /// 覆盖未来365天数据
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>更新是否成功</returns>
    public async Task<bool> UpdateScheduleCacheAsync(int venueId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始更新Redis排期缓存，场馆ID: {VenueId}", venueId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));

            var startDate = DateTime.UtcNow.Date;
            var endDate = startDate.AddDays(365);

            var scheduleSlots = await _context.ScheduleSlots
                .AsNoTracking()
                .Where(s => s.VenueId == venueId &&
                            s.StartTime >= startDate &&
                            s.StartTime <= endDate)
                .Include(s => s.EventItem)
                .Include(s => s.Resource)
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            var cacheData = Newtonsoft.Json.JsonConvert.SerializeObject(scheduleSlots);
            var cacheKey = $"{RedisKeyPrefix.Schedule}{venueId}:{startDate:yyyyMMdd}:{endDate:yyyyMMdd}";

            await _redis.StringSetAsync(cacheKey, cacheData, TimeSpan.FromHours(24));

            var monthKeys = new List<string>();
            for (var date = startDate; date < endDate; date = date.AddMonths(1))
            {
                var monthStart = new DateTime(date.Year, date.Month, 1);
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);

                var monthSlots = scheduleSlots
                    .Where(s => s.StartTime >= monthStart && s.StartTime <= monthEnd)
                    .ToList();

                var monthCacheKey = $"{RedisKeyPrefix.Schedule}{venueId}:{monthStart:yyyyMMdd}:{monthEnd:yyyyMMdd}";
                monthKeys.Add(monthCacheKey);

                await _redis.StringSetAsync(monthCacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(monthSlots),
                    TimeSpan.FromHours(24));
            }

            await _redisPublisher.PublishScheduleUpdateAsync(venueId, new
            {
                venueId,
                updatedAt = DateTime.UtcNow,
                slotCount = scheduleSlots.Count,
                coverageDays = 365
            });

            _logger.LogInformation("更新Redis排期缓存成功，场馆ID: {VenueId}, 共{Count}条记录，耗时: {Elapsed}ms",
                venueId, scheduleSlots.Count, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "更新Redis排期缓存失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"更新Redis排期缓存失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步锁定排期时段
    /// 设置7天锁定窗口
    /// </summary>
    /// <param name="scheduleSlot">排期时段</param>
    /// <param name="lockDays">锁定天数</param>
    /// <returns>锁定是否成功</returns>
    public async Task<bool> LockScheduleAsync(ScheduleSlot scheduleSlot, int lockDays)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始锁定排期时段，排期ID: {SlotId}, 锁定天数: {LockDays}天", scheduleSlot?.Id, lockDays);

            if (scheduleSlot == null)
                throw new ArgumentNullException(nameof(scheduleSlot));
            if (lockDays <= 0)
                throw new ArgumentException("锁定天数必须大于0", nameof(lockDays));

            var lockKey = $"{RedisKeyPrefix.Lock}schedule:{scheduleSlot.VenueId}:{scheduleSlot.ResourceId}:{scheduleSlot.StartTime:yyyyMMddHHmm}";
            var lockValue = $"slot:{scheduleSlot.Id}:{Guid.NewGuid()}";

            var lockTaken = await _redis.StringSetAsync(
                lockKey,
                lockValue,
                TimeSpan.FromDays(lockDays),
                When.NotExists);

            if (!lockTaken)
            {
                _logger.LogWarning("排期时段已被锁定，排期ID: {SlotId}", scheduleSlot.Id);
                return false;
            }

            var existingSlot = await _context.ScheduleSlots
                .FirstOrDefaultAsync(s => s.Id == scheduleSlot.Id);

            if (existingSlot != null)
            {
                existingSlot.IsLocked = true;
                existingSlot.LockExpiresAt = DateTime.UtcNow.AddDays(lockDays);
                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();

            await _redisPublisher.PublishScheduleUpdateAsync(scheduleSlot.VenueId, new
            {
                type = "ScheduleLocked",
                slotId = scheduleSlot.Id,
                venueId = scheduleSlot.VenueId,
                resourceId = scheduleSlot.ResourceId,
                startTime = scheduleSlot.StartTime,
                endTime = scheduleSlot.EndTime,
                lockExpiresAt = DateTime.UtcNow.AddDays(lockDays)
            });

            _logger.LogInformation("锁定排期时段成功，排期ID: {SlotId}, 锁定至: {ExpiresAt:yyyy-MM-dd HH:mm}, 耗时: {Elapsed}ms",
                scheduleSlot.Id, DateTime.UtcNow.AddDays(lockDays), stopwatch.ElapsedMilliseconds);

            return true;
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
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "锁定排期时段失败，排期ID: {SlotId}", scheduleSlot?.Id);
            throw new InvalidOperationException($"锁定排期时段失败，排期ID: {scheduleSlot?.Id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步自动释放过期锁定
    /// </summary>
    /// <returns>释放的锁定数量</returns>
    public async Task<int> ExpireLocksAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始自动释放过期锁定");

            var now = DateTime.UtcNow;
            var expiredSlots = await _context.ScheduleSlots
                .Where(s => s.IsLocked && s.LockExpiresAt.HasValue && s.LockExpiresAt <= now)
                .ToListAsync();

            var releaseCount = 0;

            foreach (var slot in expiredSlots)
            {
                var lockKey = $"{RedisKeyPrefix.Lock}schedule:{slot.VenueId}:{slot.ResourceId}:{slot.StartTime:yyyyMMddHHmm}";
                await _redis.KeyDeleteAsync(lockKey);

                slot.IsLocked = false;
                slot.LockExpiresAt = null;
                releaseCount++;

                await _redisPublisher.PublishScheduleUpdateAsync(slot.VenueId, new
                {
                    type = "ScheduleUnlocked",
                    slotId = slot.Id,
                    venueId = slot.VenueId,
                    resourceId = slot.ResourceId,
                    startTime = slot.StartTime,
                    endTime = slot.EndTime
                });
            }

            if (releaseCount > 0)
            {
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("自动释放过期锁定完成，共释放{Count}个锁定，耗时: {Elapsed}ms",
                releaseCount, stopwatch.ElapsedMilliseconds);

            return releaseCount;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "自动释放过期锁定失败");
            throw new InvalidOperationException("自动释放过期锁定失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 获取活动类型所需的设备模式
    /// </summary>
    /// <param name="eventType">活动类型</param>
    /// <returns>所需设备模式列表</returns>
    private static string[] GetRequiredEquipmentModes(string eventType)
    {
        return eventType.ToLower() switch
        {
            "concert" => new[] { "Normal", "HighPerformance" },
            "sports" => new[] { "Normal", "SportsMode" },
            "exhibition" => new[] { "Normal", "DisplayMode" },
            "business" => new[] { "Normal", "ConferenceMode" },
            _ => new[] { "Normal" }
        };
    }

    /// <summary>
    /// 计算排期建议评分
    /// </summary>
    /// <param name="suggestionDate">建议日期</param>
    /// <param name="conflictDate">冲突日期</param>
    /// <param name="hour">时段</param>
    /// <returns>评分</returns>
    private static double CalculateSuggestionScore(DateTime suggestionDate, DateTime conflictDate, int hour)
    {
        var dateDiff = Math.Abs((suggestionDate.Date - conflictDate.Date).TotalDays);
        var dateScore = Math.Max(0, 100 - dateDiff * 10);

        var hourScore = hour switch
        {
            >= 9 and <= 11 => 100,
            >= 14 and <= 17 => 90,
            >= 19 and <= 21 => 85,
            >= 8 and <= 9 => 70,
            _ => 50
        };

        return dateScore * 0.6 + hourScore * 0.4;
    }
}
