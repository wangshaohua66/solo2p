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
/// 场馆服务实现类
/// 提供场馆信息管理、查询、维护等功能
/// 实现场馆状态维护与资源锁定逻辑
/// </summary>
public class VenueService : IVenueService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<VenueService> _logger;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化场馆服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public VenueService(
        AppDbContext context,
        IDatabase redis,
        ILogger<VenueService> logger,
        IRedisPublisher redisPublisher)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _redisPublisher = redisPublisher;
    }

    /// <summary>
    /// 异步获取所有场馆列表
    /// 使用Redis缓存提升读取性能，缓存有效期5分钟
    /// </summary>
    /// <returns>场馆列表</returns>
    public async Task<IEnumerable<Venue>> GetVenuesAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆列表");
            var cacheKey = $"{RedisKeyPrefix.Venue}all";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取场馆列表成功，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<List<Venue>>(cachedData!) ?? new List<Venue>();
            }

            var venues = await _context.Venues
                .AsNoTracking()
                .OrderBy(v => v.Name)
                .ToListAsync();

            if (venues.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(venues),
                    TimeSpan.FromMinutes(5));
            }

            _logger.LogInformation("从数据库获取场馆列表成功，共{Count}条，耗时: {Elapsed}ms",
                venues.Count, stopwatch.ElapsedMilliseconds);

            return venues;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆列表失败");
            throw new InvalidOperationException("获取场馆列表失败，请稍后重试", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步根据ID获取场馆信息
    /// 使用Redis缓存提升读取性能，缓存有效期10分钟
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>场馆信息，不存在返回null</returns>
    public async Task<Venue?> GetVenueByIdAsync(int id)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆信息，ID: {Id}", id);

            if (id <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(id));

            var cacheKey = $"{RedisKeyPrefix.Venue}{id}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取场馆信息成功，ID: {Id}，耗时: {Elapsed}ms",
                    id, stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<Venue>(cachedData!);
            }

            var venue = await _context.Venues
                .AsNoTracking()
                .Include(v => v.Resources)
                .Include(v => v.Equipments)
                .FirstOrDefaultAsync(v => v.Id == id);

            if (venue != null)
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(venue),
                    TimeSpan.FromMinutes(10));
            }

            _logger.LogInformation("从数据库获取场馆信息成功，ID: {Id}，耗时: {Elapsed}ms",
                id, stopwatch.ElapsedMilliseconds);

            return venue;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆信息失败，ID: {Id}", id);
            throw new InvalidOperationException($"获取场馆信息失败，ID: {id}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取场馆下的所有资源
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>资源列表</returns>
    public async Task<IEnumerable<Resource>> GetResourcesByVenueAsync(int venueId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆资源列表，场馆ID: {VenueId}", venueId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));

            var cacheKey = $"{RedisKeyPrefix.Resource}venue:{venueId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取场馆资源列表成功，场馆ID: {VenueId}，耗时: {Elapsed}ms",
                    venueId, stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<List<Resource>>(cachedData!) ?? new List<Resource>();
            }

            var resources = await _context.Resources
                .AsNoTracking()
                .Where(r => r.VenueId == venueId)
                .OrderBy(r => r.Type)
                .ThenBy(r => r.Name)
                .ToListAsync();

            if (resources.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(resources),
                    TimeSpan.FromMinutes(3));
            }

            _logger.LogInformation("从数据库获取场馆资源列表成功，场馆ID: {VenueId}，共{Count}条，耗时: {Elapsed}ms",
                venueId, resources.Count, stopwatch.ElapsedMilliseconds);

            return resources;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆资源列表失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"获取场馆资源列表失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取指定资源信息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <returns>资源信息，不存在返回null</returns>
    public async Task<Resource?> GetResourceByIdAsync(int venueId, int resourceId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取资源信息，场馆ID: {VenueId}，资源ID: {ResourceId}", venueId, resourceId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (resourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(resourceId));

            var cacheKey = $"{RedisKeyPrefix.Resource}{resourceId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedResource = Newtonsoft.Json.JsonConvert.DeserializeObject<Resource>(cachedData!);
                if (cachedResource?.VenueId == venueId)
                {
                    _logger.LogInformation("从Redis缓存获取资源信息成功，场馆ID: {VenueId}，资源ID: {ResourceId}，耗时: {Elapsed}ms",
                        venueId, resourceId, stopwatch.ElapsedMilliseconds);
                    return cachedResource;
                }
            }

            var resource = await _context.Resources
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == resourceId && r.VenueId == venueId);

            if (resource != null)
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(resource),
                    TimeSpan.FromMinutes(5));
            }

            _logger.LogInformation("从数据库获取资源信息成功，场馆ID: {VenueId}，资源ID: {ResourceId}，耗时: {Elapsed}ms",
                venueId, resourceId, stopwatch.ElapsedMilliseconds);

            return resource;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取资源信息失败，场馆ID: {VenueId}，资源ID: {ResourceId}", venueId, resourceId);
            throw new InvalidOperationException($"获取资源信息失败，资源ID: {resourceId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步更新资源位置坐标
    /// 更新后自动清除相关缓存并发布状态变更消息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <param name="x">X坐标</param>
    /// <param name="y">Y坐标</param>
    /// <param name="z">Z坐标（楼层）</param>
    /// <returns>更新是否成功</returns>
    public async Task<bool> UpdateResourcePositionAsync(int venueId, int resourceId, double x, double y, double z)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始更新资源位置，场馆ID: {VenueId}，资源ID: {ResourceId}，坐标: ({X}, {Y}, {Z})",
                venueId, resourceId, x, y, z);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (resourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(resourceId));

            var resource = await _context.Resources
                .FirstOrDefaultAsync(r => r.Id == resourceId && r.VenueId == venueId);

            if (resource == null)
            {
                _logger.LogWarning("资源不存在，场馆ID: {VenueId}，资源ID: {ResourceId}", venueId, resourceId);
                return false;
            }

            resource.PositionX = x;
            resource.PositionY = y;
            resource.PositionZ = z;
            resource.Status = nameof(ResourceStatus.Available);

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();

                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}{resourceId}");
                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}venue:{venueId}");

                await _redisPublisher.PublishResourceStatusAsync(resourceId, resource.Status);

                _logger.LogInformation("更新资源位置成功，场馆ID: {VenueId}，资源ID: {ResourceId}，耗时: {Elapsed}ms",
                    venueId, resourceId, stopwatch.ElapsedMilliseconds);
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
            _logger.LogError(ex, "更新资源位置失败，场馆ID: {VenueId}，资源ID: {ResourceId}", venueId, resourceId);
            throw new InvalidOperationException($"更新资源位置失败，资源ID: {resourceId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取场馆统计数据
    /// 统计指定日期范围内的活动数量、营收、资源利用率等指标
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">统计开始日期</param>
    /// <param name="endDate">统计结束日期</param>
    /// <returns>统计数据字典</returns>
    public async Task<Dictionary<string, object>> GetVenueStatsAsync(int venueId, DateTime startDate, DateTime endDate)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆统计数据，场馆ID: {VenueId}，日期范围: {StartDate:yyyy-MM-dd} 至 {EndDate:yyyy-MM-dd}",
                venueId, startDate, endDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (startDate >= endDate)
                throw new ArgumentException("开始日期必须早于结束日期", nameof(startDate));

            var cacheKey = $"{RedisKeyPrefix.Venue}stats:{venueId}:{startDate:yyyyMMdd}:{endDate:yyyyMMdd}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取场馆统计数据成功，场馆ID: {VenueId}，耗时: {Elapsed}ms",
                    venueId, stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(cachedData!) ?? new Dictionary<string, object>();
            }

            var events = await _context.Events
                .AsNoTracking()
                .Where(e => e.VenueId == venueId && e.StartDate >= startDate && e.EndDate <= endDate)
                .Include(e => e.TicketSales)
                .Include(e => e.ScheduleSlots)
                .ToListAsync();

            var totalRevenue = events.Sum(e => e.TicketSales.Sum(t => t.Revenue));
            var totalEvents = events.Count;
            var completedEvents = events.Count(e => e.Status == nameof(EventStatus.Completed));
            var totalAttendance = events.Sum(e => e.TicketSales.Sum(t => t.QuantitySold));
            var scheduledSlots = events.Sum(e => e.ScheduleSlots.Count);

            var totalResources = await _context.Resources
                .AsNoTracking()
                .CountAsync(r => r.VenueId == venueId);

            var stats = new Dictionary<string, object>
            {
                ["venueId"] = venueId,
                ["startDate"] = startDate,
                ["endDate"] = endDate,
                ["totalEvents"] = totalEvents,
                ["completedEvents"] = completedEvents,
                ["cancelledEvents"] = events.Count(e => e.Status == nameof(EventStatus.Cancelled)),
                ["pendingEvents"] = events.Count(e => e.Status == nameof(EventStatus.PendingApproval)),
                ["totalRevenue"] = totalRevenue,
                ["averageRevenuePerEvent"] = totalEvents > 0 ? totalRevenue / totalEvents : 0,
                ["totalAttendance"] = totalAttendance,
                ["averageAttendancePerEvent"] = totalEvents > 0 ? (int)(totalAttendance / totalEvents) : 0,
                ["totalResources"] = totalResources,
                ["scheduledSlots"] = scheduledSlots,
                ["resourceUtilizationRate"] = totalResources > 0 && scheduledSlots > 0
                    ? Math.Round((double)scheduledSlots / (totalResources * (endDate - startDate).TotalDays) * 100, 2)
                    : 0,
                ["generatedAt"] = DateTime.UtcNow
            };

            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(stats),
                TimeSpan.FromHours(1));

            _logger.LogInformation("获取场馆统计数据成功，场馆ID: {VenueId}，总活动数: {TotalEvents}，总营收: {TotalRevenue:C}，耗时: {Elapsed}ms",
                venueId, totalEvents, totalRevenue, stopwatch.ElapsedMilliseconds);

            return stats;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆统计数据失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"获取场馆统计数据失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取场馆设备列表
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>设备列表</returns>
    public async Task<IEnumerable<Equipment>> GetEquipmentByVenueAsync(int venueId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取场馆设备列表，场馆ID: {VenueId}", venueId);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));

            var cacheKey = $"{RedisKeyPrefix.Equipment}venue:{venueId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取场馆设备列表成功，场馆ID: {VenueId}，耗时: {Elapsed}ms",
                    venueId, stopwatch.ElapsedMilliseconds);
                return Newtonsoft.Json.JsonConvert.DeserializeObject<List<Equipment>>(cachedData!) ?? new List<Equipment>();
            }

            var equipments = await _context.Equipments
                .AsNoTracking()
                .Where(e => e.VenueId == venueId)
                .OrderBy(e => e.Type)
                .ThenBy(e => e.Name)
                .ToListAsync();

            if (equipments.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(equipments),
                    TimeSpan.FromMinutes(5));
            }

            _logger.LogInformation("从数据库获取场馆设备列表成功，场馆ID: {VenueId}，共{Count}条，耗时: {Elapsed}ms",
                venueId, equipments.Count, stopwatch.ElapsedMilliseconds);

            return equipments;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆设备列表失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException($"获取场馆设备列表失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步设置场馆设备运行模式
    /// 实现设备模式差异化校验，确保设备支持目标模式
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="mode">设备模式（Normal/Maintenance/Emergency）</param>
    /// <returns>设置是否成功</returns>
    public async Task<bool> SetEquipmentModeAsync(int venueId, string mode)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始设置场馆设备模式，场馆ID: {VenueId}，目标模式: {Mode}", venueId, mode);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (string.IsNullOrWhiteSpace(mode))
                throw new ArgumentException("设备模式不能为空", nameof(mode));

            var validModes = new[] { "Normal", "Maintenance", "Emergency" };
            if (!validModes.Contains(mode, StringComparer.OrdinalIgnoreCase))
                throw new ArgumentException($"无效的设备模式，有效值为: {string.Join(", ", validModes)}", nameof(mode));

            var equipments = await _context.Equipments
                .Where(e => e.VenueId == venueId)
                .ToListAsync();

            if (!equipments.Any())
            {
                _logger.LogWarning("场馆下没有设备，场馆ID: {VenueId}", venueId);
                return false;
            }

            var incompatibleEquipments = equipments
                .Where(e => !e.ModeCompatibility.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Contains(mode, StringComparer.OrdinalIgnoreCase))
                .ToList();

            if (incompatibleEquipments.Any())
            {
                var incompatibleNames = string.Join(", ", incompatibleEquipments.Select(e => e.Name));
                _logger.LogWarning("部分设备不支持目标模式 {Mode}: {IncompatibleNames}", mode, incompatibleNames);
                throw new InvalidOperationException($"以下设备不支持{mode}模式: {incompatibleNames}");
            }

            foreach (var equipment in equipments)
            {
                equipment.Status = mode;
                equipment.LastMaintenance = DateTime.UtcNow;
            }

            var result = await _context.SaveChangesAsync() > 0;

            if (result)
            {
                await transaction.CommitAsync();

                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Equipment}venue:{venueId}");
                foreach (var equipment in equipments)
                {
                    await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Equipment}{equipment.Id}");
                }

                _logger.LogInformation("设置场馆设备模式成功，场馆ID: {VenueId}，模式: {Mode}，更新设备数: {Count}，耗时: {Elapsed}ms",
                    venueId, mode, equipments.Count, stopwatch.ElapsedMilliseconds);
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
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "设置场馆设备模式失败，场馆ID: {VenueId}，模式: {Mode}", venueId, mode);
            throw new InvalidOperationException($"设置场馆设备模式失败，场馆ID: {venueId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步锁定资源
    /// 使用Redis分布式锁确保并发安全
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <param name="eventId">关联活动ID</param>
    /// <param name="duration">锁定时长（分钟）</param>
    /// <returns>锁定是否成功</returns>
    public async Task<bool> LockResourceAsync(int resourceId, int eventId, int duration)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始锁定资源，资源ID: {ResourceId}，活动ID: {EventId}，时长: {Duration}分钟",
                resourceId, eventId, duration);

            if (resourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(resourceId));
            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));
            if (duration <= 0)
                throw new ArgumentException("锁定时长必须大于0", nameof(duration));

            var lockKey = $"{RedisKeyPrefix.Lock}resource:{resourceId}";
            var lockValue = $"event:{eventId}:{Guid.NewGuid()}";

            var lockTaken = await _redis.StringSetAsync(
                lockKey,
                lockValue,
                TimeSpan.FromMinutes(duration),
                When.NotExists);

            if (!lockTaken)
            {
                _logger.LogWarning("资源已被锁定，资源ID: {ResourceId}", resourceId);
                return false;
            }

            var resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == resourceId);
            if (resource != null)
            {
                resource.Status = nameof(ResourceStatus.Reserved);
                await _context.SaveChangesAsync();

                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}{resourceId}");
                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}venue:{resource.VenueId}");

                await _redisPublisher.PublishResourceStatusAsync(resourceId, nameof(ResourceStatus.Reserved));
            }

            _logger.LogInformation("锁定资源成功，资源ID: {ResourceId}，活动ID: {EventId}，时长: {Duration}分钟，耗时: {Elapsed}ms",
                resourceId, eventId, duration, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "锁定资源失败，资源ID: {ResourceId}，活动ID: {EventId}", resourceId, eventId);
            throw new InvalidOperationException($"锁定资源失败，资源ID: {resourceId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步解锁资源
    /// 释放Redis分布式锁并更新资源状态
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <returns>解锁是否成功</returns>
    public async Task<bool> UnlockResourceAsync(int resourceId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始解锁资源，资源ID: {ResourceId}", resourceId);

            if (resourceId <= 0)
                throw new ArgumentException("资源ID必须大于0", nameof(resourceId));

            var lockKey = $"{RedisKeyPrefix.Lock}resource:{resourceId}";
            var exists = await _redis.KeyExistsAsync(lockKey);

            if (exists)
            {
                await _redis.KeyDeleteAsync(lockKey);
            }

            var resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == resourceId);
            if (resource != null)
            {
                resource.Status = nameof(ResourceStatus.Available);
                await _context.SaveChangesAsync();

                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}{resourceId}");
                await _redis.KeyDeleteAsync($"{RedisKeyPrefix.Resource}venue:{resource.VenueId}");

                await _redisPublisher.PublishResourceStatusAsync(resourceId, nameof(ResourceStatus.Available));
            }

            _logger.LogInformation("解锁资源成功，资源ID: {ResourceId}，耗时: {Elapsed}ms",
                resourceId, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "解锁资源失败，资源ID: {ResourceId}", resourceId);
            throw new InvalidOperationException($"解锁资源失败，资源ID: {resourceId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
