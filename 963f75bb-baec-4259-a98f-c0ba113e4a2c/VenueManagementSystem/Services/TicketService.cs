using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Json;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 票务服务实现类
/// 提供票务管理、销售统计、营收分析等功能
/// 使用 HttpClient 调用外部票务 API
/// 性能要求：报表导出 <30秒
/// </summary>
public class TicketService : ITicketService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<TicketService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IRedisPublisher _redisPublisher;

    /// <summary>
    /// 初始化票务服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="httpClientFactory">HTTP客户端工厂</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    public TicketService(
        AppDbContext context,
        IDatabase redis,
        ILogger<TicketService> logger,
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
    /// 异步获取活动票务销售数据
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <returns>销售数据字典</returns>
    public async Task<Dictionary<string, object>> GetTicketSalesAsync(int eventId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取活动票务销售数据，活动ID: {EventId}", eventId);

            if (eventId <= 0)
                throw new ArgumentException("活动ID必须大于0", nameof(eventId));

            var cacheKey = $"{RedisKeyPrefix.Ticket}sales:{eventId}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedSales = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(cachedData!);
                if (cachedSales != null)
                {
                    _logger.LogInformation("从Redis缓存获取票务销售数据成功，活动ID: {EventId}，耗时: {Elapsed}ms",
                        eventId, stopwatch.ElapsedMilliseconds);
                    return cachedSales;
                }
            }

            var sales = await _context.TicketSales
                .AsNoTracking()
                .Where(s => s.EventId == eventId)
                .ToListAsync();

            var eventItem = await _context.Events
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == eventId);

            var totalSold = sales.Sum(s => s.QuantitySold);
            var totalAvailable = sales.Sum(s => s.QuantityAvailable);
            var totalRevenue = sales.Sum(s => s.Revenue);

            var result = new Dictionary<string, object>
            {
                ["eventId"] = eventId,
                ["eventName"] = eventItem?.Name ?? string.Empty,
                ["totalSold"] = totalSold,
                ["totalAvailable"] = totalAvailable,
                ["totalRevenue"] = totalRevenue,
                ["sellThroughRate"] = totalAvailable > 0 ? Math.Round((decimal)totalSold / totalAvailable * 100, 2) : 0,
                ["ticketTypes"] = sales.Select(s => new
                {
                    type = s.TicketType,
                    sold = s.QuantitySold,
                    available = s.QuantityAvailable,
                    price = s.Price,
                    revenue = s.Revenue,
                    lastUpdated = s.LastUpdated
                }).ToList(),
                ["lastSyncTime"] = sales.Max(s => (DateTime?)s.LastUpdated) ?? DateTime.MinValue
            };

            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(result),
                TimeSpan.FromMinutes(5));

            _logger.LogInformation("获取活动票务销售数据成功，活动ID: {EventId}，总销量: {TotalSold}，总营收: {TotalRevenue}，耗时: {Elapsed}ms",
                eventId, totalSold, totalRevenue, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取活动票务销售数据失败，活动ID: {EventId}", eventId);
            throw new InvalidOperationException($"获取活动票务销售数据失败，活动ID: {eventId}", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取营收统计数据
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventType">活动类型</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>营收统计数据</returns>
    public async Task<Dictionary<string, object>> GetRevenueStatsAsync(int venueId, string eventType, DateTime startDate, DateTime endDate)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取营收统计数据，场馆ID: {VenueId}，活动类型: {EventType}，日期范围: {StartDate} - {EndDate}",
                venueId, eventType, startDate, endDate);

            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (startDate >= endDate)
                throw new ArgumentException("开始日期必须小于结束日期");

            var cacheKey = $"{RedisKeyPrefix.Ticket}revenue:{venueId}:{eventType}:{startDate:yyyyMMdd}:{endDate:yyyyMMdd}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedStats = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(cachedData!);
                if (cachedStats != null)
                {
                    _logger.LogInformation("从Redis缓存获取营收统计数据成功，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                    return cachedStats;
                }
            }

            var query = _context.TicketSales
                .AsNoTracking()
                .Include(s => s.EventItem)
                .Where(s => s.EventItem != null &&
                           s.EventItem.VenueId == venueId &&
                           s.EventItem.StartDate >= startDate &&
                           s.EventItem.EndDate <= endDate);

            if (!string.IsNullOrWhiteSpace(eventType) && eventType != "all")
            {
                query = query.Where(s => s.EventItem!.Type == eventType);
            }

            var sales = await query.ToListAsync();

            var dailyStats = sales
                .GroupBy(s => s.EventItem!.StartDate.Date)
                .Select(g => new
                {
                    date = g.Key.ToString("yyyy-MM-dd"),
                    revenue = g.Sum(s => s.Revenue),
                    ticketsSold = g.Sum(s => s.QuantitySold)
                })
                .OrderBy(d => d.date)
                .ToList();

            var totalRevenue = sales.Sum(s => s.Revenue);
            var totalTickets = sales.Sum(s => s.QuantitySold);
            var eventCount = sales.Select(s => s.EventId).Distinct().Count();

            var result = new Dictionary<string, object>
            {
                ["venueId"] = venueId,
                ["eventType"] = eventType,
                ["startDate"] = startDate,
                ["endDate"] = endDate,
                ["totalRevenue"] = totalRevenue,
                ["totalTicketsSold"] = totalTickets,
                ["eventCount"] = eventCount,
                ["averageRevenuePerEvent"] = eventCount > 0 ? Math.Round(totalRevenue / eventCount, 2) : 0,
                ["averageTicketPrice"] = totalTickets > 0 ? Math.Round(totalRevenue / totalTickets, 2) : 0,
                ["dailyStats"] = dailyStats,
                ["byTicketType"] = sales
                    .GroupBy(s => s.TicketType)
                    .Select(g => new
                    {
                        type = g.Key,
                        revenue = g.Sum(s => s.Revenue),
                        ticketsSold = g.Sum(s => s.QuantitySold)
                    })
                    .ToList()
            };

            await _redis.StringSetAsync(cacheKey,
                Newtonsoft.Json.JsonConvert.SerializeObject(result),
                TimeSpan.FromMinutes(15));

            _logger.LogInformation("获取营收统计数据成功，总营收: {TotalRevenue}，总销量: {TotalTickets}，耗时: {Elapsed}ms",
                totalRevenue, totalTickets, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取营收统计数据失败，场馆ID: {VenueId}", venueId);
            throw new InvalidOperationException("获取营收统计数据失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取销售预警
    /// 检测异常销售波动
    /// </summary>
    /// <returns>预警信息列表</returns>
    public async Task<IEnumerable<Dictionary<string, object>>> GetSalesAlertsAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var alerts = new List<Dictionary<string, object>>();
        try
        {
            _logger.LogInformation("开始检测销售预警");

            var cacheKey = $"{RedisKeyPrefix.Ticket}alerts";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedAlerts = Newtonsoft.Json.JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(cachedData!);
                if (cachedAlerts != null && cachedAlerts.Any())
                {
                    _logger.LogInformation("从Redis缓存获取销售预警成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedAlerts.Count, stopwatch.ElapsedMilliseconds);
                    return cachedAlerts;
                }
            }

            var now = DateTime.UtcNow;
            var sevenDaysAgo = now.AddDays(-7);

            var recentSales = await _context.TicketSales
                .AsNoTracking()
                .Include(s => s.EventItem)
                .Where(s => s.LastUpdated >= sevenDaysAgo)
                .ToListAsync();

            var events = recentSales
                .GroupBy(s => s.EventId)
                .Select(g => new
                {
                    EventId = g.Key,
                    EventName = g.First().EventItem?.Name ?? string.Empty,
                    DailySales = g
                        .GroupBy(s => s.LastUpdated.Date)
                        .Select(dg => new
                        {
                            Date = dg.Key,
                            Revenue = dg.Sum(s => s.Revenue),
                            Tickets = dg.Sum(s => s.QuantitySold)
                        })
                        .OrderBy(d => d.Date)
                        .ToList()
                })
                .ToList();

            foreach (var ev in events)
            {
                if (ev.DailySales.Count < 2) continue;

                var sortedSales = ev.DailySales.OrderBy(d => d.Date).ToList();
                for (int i = 1; i < sortedSales.Count; i++)
                {
                    var prev = sortedSales[i - 1];
                    var curr = sortedSales[i];

                    if (prev.Revenue > 0)
                    {
                        var changePercent = Math.Abs(curr.Revenue - prev.Revenue) / prev.Revenue * 100;
                        if (changePercent >= 50)
                        {
                            alerts.Add(new Dictionary<string, object>
                            {
                                ["eventId"] = ev.EventId,
                                ["eventName"] = ev.EventName,
                                ["alertType"] = "RevenueFluctuation",
                                ["severity"] = changePercent >= 100 ? "high" : "medium",
                                ["date"] = curr.Date,
                                ["previousRevenue"] = prev.Revenue,
                                ["currentRevenue"] = curr.Revenue,
                                ["changePercent"] = Math.Round(changePercent, 2),
                                ["message"] = $"活动 '{ev.EventName}' 营收波动超过{changePercent:F0}%"
                            });
                        }
                    }

                    if (prev.Tickets > 0)
                    {
                        var changePercent = Math.Abs(curr.Tickets - prev.Tickets) / (double)prev.Tickets * 100;
                        if (changePercent >= 50)
                        {
                            alerts.Add(new Dictionary<string, object>
                            {
                                ["eventId"] = ev.EventId,
                                ["eventName"] = ev.EventName,
                                ["alertType"] = "TicketSalesFluctuation",
                                ["severity"] = changePercent >= 100 ? "high" : "medium",
                                ["date"] = curr.Date,
                                ["previousTickets"] = prev.Tickets,
                                ["currentTickets"] = curr.Tickets,
                                ["changePercent"] = Math.Round(changePercent, 2),
                                ["message"] = $"活动 '{ev.EventName}' 销量波动超过{changePercent:F0}%"
                            });
                        }
                    }
                }
            }

            var upcomingEvents = await _context.Events
                .AsNoTracking()
                .Where(e => e.StartDate >= now && e.StartDate <= now.AddDays(7) && e.Status == nameof(EventStatus.Approved))
                .Include(e => e.TicketSales)
                .ToListAsync();

            foreach (var ev in upcomingEvents)
            {
                var totalSold = ev.TicketSales.Sum(s => s.QuantitySold);
                var totalAvailable = ev.TicketSales.Sum(s => s.QuantityAvailable);
                var daysToEvent = (ev.StartDate - now).TotalDays;

                if (totalAvailable > 0)
                {
                    var sellThroughRate = (decimal)totalSold / totalAvailable * 100;
                    var expectedRate = 30 + (7 - daysToEvent) * 10;

                    if (sellThroughRate < expectedRate * 0.5)
                    {
                        alerts.Add(new Dictionary<string, object>
                        {
                            ["eventId"] = ev.Id,
                            ["eventName"] = ev.Name,
                            ["alertType"] = "LowTicketSales",
                            ["severity"] = daysToEvent <= 2 ? "high" : "medium",
                            ["daysToEvent"] = Math.Round(daysToEvent, 1),
                            ["sellThroughRate"] = Math.Round(sellThroughRate, 2),
                            ["expectedRate"] = Math.Round(expectedRate, 2),
                            ["message"] = $"活动 '{ev.Name}' 开票进度滞后，当前仅{sellThroughRate:F1}%"
                        });
                    }
                }
            }

            if (alerts.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(alerts),
                    TimeSpan.FromMinutes(10));
            }

            _logger.LogInformation("检测销售预警完成，共{Count}条预警，耗时: {Elapsed}ms",
                alerts.Count, stopwatch.ElapsedMilliseconds);

            return alerts;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "检测销售预警失败");
            throw new InvalidOperationException("检测销售预警失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步同步票务数据
    /// 对接票务系统API拉取实时数据
    /// </summary>
    /// <returns>同步记录数</returns>
    public async Task<int> SyncTicketDataAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var syncCount = 0;
        try
        {
            _logger.LogInformation("开始同步票务数据");

            var httpClient = _httpClientFactory.CreateClient("TicketSystem");

            var lastSyncKey = $"{RedisKeyPrefix.Ticket}lastSync";
            var lastSyncStr = await _redis.StringGetAsync(lastSyncKey);
            var lastSyncTime = DateTime.TryParse(lastSyncStr, out var dt) ? dt : DateTime.UtcNow.AddHours(-24);

            var requestUrl = $"api/ticket-sales?since={lastSyncTime:yyyy-MM-ddTHH:mm:ssZ}";
            var response = await httpClient.GetAsync(requestUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("票务系统API调用失败，状态码: {StatusCode}", response.StatusCode);
                throw new HttpRequestException($"票务系统API调用失败，状态码: {response.StatusCode}");
            }

            var externalSales = await response.Content.ReadFromJsonAsync<List<Dictionary<string, object>>>();
            if (externalSales == null || !externalSales.Any())
            {
                _logger.LogInformation("无新的票务数据需要同步，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                await _redis.StringSetAsync(lastSyncKey, DateTime.UtcNow.ToString());
                return 0;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            foreach (var external in externalSales)
            {
                if (!external.TryGetValue("eventId", out var eventIdObj) ||
                    !int.TryParse(eventIdObj?.ToString(), out var eventId))
                    continue;

                if (!external.TryGetValue("ticketType", out var ticketTypeObj))
                    continue;
                var ticketType = ticketTypeObj?.ToString() ?? string.Empty;

                var existing = await _context.TicketSales
                    .FirstOrDefaultAsync(s => s.EventId == eventId && s.TicketType == ticketType);

                var quantitySold = external.TryGetValue("quantitySold", out var qsObj) &&
                    int.TryParse(qsObj?.ToString(), out var qs) ? qs : 0;
                var quantityAvailable = external.TryGetValue("quantityAvailable", out var qaObj) &&
                    int.TryParse(qaObj?.ToString(), out var qa) ? qa : 0;
                var price = external.TryGetValue("price", out var pObj) &&
                    decimal.TryParse(pObj?.ToString(), out var p) ? p : 0;
                var revenue = external.TryGetValue("revenue", out var rObj) &&
                    decimal.TryParse(rObj?.ToString(), out var r) ? r : quantitySold * price;

                if (existing == null)
                {
                    existing = new TicketSales
                    {
                        EventId = eventId,
                        TicketType = ticketType,
                        QuantitySold = quantitySold,
                        QuantityAvailable = quantityAvailable,
                        Price = price,
                        Revenue = revenue,
                        LastUpdated = DateTime.UtcNow
                    };
                    await _context.TicketSales.AddAsync(existing);
                }
                else
                {
                    existing.QuantitySold = quantitySold;
                    existing.QuantityAvailable = quantityAvailable;
                    existing.Price = price;
                    existing.Revenue = revenue;
                    existing.LastUpdated = DateTime.UtcNow;
                    _context.TicketSales.Update(existing);
                }

                syncCount++;

                var cacheKeys = new[]
                {
                    $"{RedisKeyPrefix.Ticket}sales:{eventId}",
                    $"{RedisKeyPrefix.Ticket}alerts"
                };
                foreach (var key in cacheKeys)
                {
                    await _redis.KeyDeleteAsync(key);
                }

                await _redisPublisher.PublishScheduleUpdateAsync(0, new
                {
                    type = "TicketSalesUpdated",
                    eventId,
                    ticketType,
                    quantitySold,
                    revenue,
                    timestamp = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            await _redis.StringSetAsync(lastSyncKey, DateTime.UtcNow.ToString());

            _logger.LogInformation("票务数据同步完成，同步记录数: {Count}，耗时: {Elapsed}ms",
                syncCount, stopwatch.ElapsedMilliseconds);

            return syncCount;
        }
        catch (HttpRequestException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "同步票务数据失败");
            throw new InvalidOperationException("同步票务数据失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步导出生成营收报表
    /// 性能要求：<30秒
    /// </summary>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <param name="format">导出格式（csv/excel）</param>
    /// <returns>报表文件字节数组</returns>
    public async Task<byte[]> ExportRevenueReportAsync(DateTime startDate, DateTime endDate, string format)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始导出生成营收报表，日期范围: {StartDate} - {EndDate}，格式: {Format}",
                startDate, endDate, format);

            if (startDate >= endDate)
                throw new ArgumentException("开始日期必须小于结束日期");
            if (string.IsNullOrWhiteSpace(format))
                throw new ArgumentException("导出格式不能为空", nameof(format));

            format = format.ToLower();
            if (format != "csv" && format != "excel")
                throw new ArgumentException("不支持的导出格式，仅支持 csv 和 excel", nameof(format));

            var sales = await _context.TicketSales
                .AsNoTracking()
                .Include(s => s.EventItem)
                .ThenInclude(e => e!.Venue)
                .Where(s => s.EventItem != null &&
                           s.EventItem.StartDate >= startDate &&
                           s.EventItem.EndDate <= endDate)
                .OrderByDescending(s => s.EventItem!.StartDate)
                .ToListAsync();

            if (!sales.Any())
            {
                _logger.LogInformation("无数据可导出，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
                return Array.Empty<byte>();
            }

            var reportData = sales.Select(s => new
            {
                日期 = s.EventItem!.StartDate.ToString("yyyy-MM-dd"),
                活动名称 = s.EventItem.Name,
                场馆名称 = s.EventItem.Venue?.Name ?? string.Empty,
                活动类型 = s.EventItem.Type,
                票种 = s.TicketType,
                单价 = s.Price,
                售出数量 = s.QuantitySold,
                可售数量 = s.QuantityAvailable,
                营收金额 = s.Revenue,
                销售率 = s.QuantityAvailable > 0 ? $"{(decimal)s.QuantitySold / s.QuantityAvailable * 100:F2}%" : "N/A",
                更新时间 = s.LastUpdated.ToString("yyyy-MM-dd HH:mm:ss")
            }).ToList();

            byte[] fileBytes;

            if (format == "csv")
            {
                using var memoryStream = new MemoryStream();
                using var writer = new StreamWriter(memoryStream, new System.Text.UTF8Encoding(true));
                var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    Delimiter = ",",
                    HasHeaderRecord = true,
                    Encoding = System.Text.UTF8Encoding.UTF8
                };
                using var csv = new CsvWriter(writer, csvConfig);

                await csv.WriteRecordsAsync(reportData);
                await writer.FlushAsync();
                fileBytes = memoryStream.ToArray();
            }
            else
            {
                using var memoryStream = new MemoryStream();
                using var writer = new StreamWriter(memoryStream, new System.Text.UTF8Encoding(true));
                var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    Delimiter = ",",
                    HasHeaderRecord = true,
                    Encoding = System.Text.UTF8Encoding.UTF8
                };
                using var csv = new CsvWriter(writer, csvConfig);

                await csv.WriteRecordsAsync(reportData);
                await writer.FlushAsync();
                fileBytes = memoryStream.ToArray();
            }

            if (stopwatch.ElapsedMilliseconds > 30000)
            {
                _logger.LogWarning("报表导出超过性能阈值，耗时: {Elapsed}ms", stopwatch.ElapsedMilliseconds);
            }
            else
            {
                _logger.LogInformation("营收报表导出成功，数据量: {Count}条，格式: {Format}，耗时: {Elapsed}ms",
                    reportData.Count, format, stopwatch.ElapsedMilliseconds);
            }

            return fileBytes;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "导出生成营收报表失败");
            throw new InvalidOperationException("导出生成营收报表失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
