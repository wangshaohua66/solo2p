using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 报表服务实现类
/// 提供各类业务报表生成、导出功能
/// 支持 CSV / Excel 格式，使用 CsvHelper 导出
/// </summary>
public class ReportService : IReportService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<ReportService> _logger;

    /// <summary>
    /// 初始化报表服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    public ReportService(
        AppDbContext context,
        IDatabase redis,
        ILogger<ReportService> logger)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
    }

    /// <summary>
    /// 异步生成月度营收报表
    /// 支持CSV/Excel格式，使用CsvHelper导出
    /// </summary>
    /// <param name="year">年份</param>
    /// <param name="month">月份</param>
    /// <param name="format">导出格式（csv/excel）</param>
    /// <returns>报表文件字节数组</returns>
    public async Task<byte[]> GenerateMonthlyRevenueReportAsync(int year, int month, string format = "csv")
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始生成月度营收报表，年份: {Year}，月份: {Month}，格式: {Format}",
                year, month, format);

            if (year < 2000 || year > 2100)
                throw new ArgumentException("年份范围无效", nameof(year));
            if (month < 1 || month > 12)
                throw new ArgumentException("月份范围无效", nameof(month));
            if (string.IsNullOrWhiteSpace(format))
                throw new ArgumentException("导出格式不能为空", nameof(format));

            format = format.ToLower();
            if (format != "csv" && format != "excel")
                throw new ArgumentException("不支持的导出格式，仅支持 csv 和 excel", nameof(format));

            var cacheKey = $"{RedisKeyPrefix.Ticket}report:{year}:{month}:{format}";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                _logger.LogInformation("从Redis缓存获取月度营收报表成功，耗时: {Elapsed}ms",
                    stopwatch.ElapsedMilliseconds);
                return Convert.FromBase64String(cachedData!);
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            var sales = await _context.TicketSales
                .AsNoTracking()
                .Include(s => s.EventItem)
                .ThenInclude(e => e!.Venue)
                .Where(s => s.EventItem != null &&
                           s.EventItem.StartDate >= startDate &&
                           s.EventItem.EndDate <= endDate)
                .OrderBy(s => s.EventItem!.StartDate)
                .ToListAsync();

            if (!sales.Any())
            {
                _logger.LogInformation("当月无销售数据，年份: {Year}，月份: {Month}", year, month);
                return Array.Empty<byte>();
            }

            var summaryData = new List<Dictionary<string, object>>
            {
                new()
                {
                    ["项目"] = "统计周期",
                    ["数值"] = $"{year}年{month}月"
                },
                new()
                {
                    ["项目"] = "活动总数",
                    ["数值"] = sales.Select(s => s.EventId).Distinct().Count().ToString()
                },
                new()
                {
                    ["项目"] = "总售票数",
                    ["数值"] = sales.Sum(s => s.QuantitySold).ToString()
                },
                new()
                {
                    ["项目"] = "总营收",
                    ["数值"] = sales.Sum(s => s.Revenue).ToString("F2")
                },
                new()
                {
                    ["项目"] = "平均票价",
                    ["数值"] = (sales.Sum(s => s.QuantitySold) > 0
                        ? sales.Sum(s => s.Revenue) / sales.Sum(s => s.QuantitySold)
                        : 0).ToString("F2")
                }
            };

            var detailData = sales.Select(s => new Dictionary<string, object>
            {
                ["日期"] = s.EventItem!.StartDate.ToString("yyyy-MM-dd"),
                ["活动名称"] = s.EventItem.Name,
                ["场馆"] = s.EventItem.Venue?.Name ?? string.Empty,
                ["活动类型"] = s.EventItem.Type,
                ["票种"] = s.TicketType,
                ["单价"] = s.Price.ToString("F2"),
                ["售出数量"] = s.QuantitySold.ToString(),
                ["可售数量"] = s.QuantityAvailable.ToString(),
                ["营收金额"] = s.Revenue.ToString("F2"),
                ["销售率"] = s.QuantityAvailable > 0
                    ? $"{(decimal)s.QuantitySold / s.QuantityAvailable * 100:F2}%"
                    : "N/A"
            }).ToList();

            var byVenueData = sales
                .GroupBy(s => s.EventItem!.VenueId)
                .Select(g => new Dictionary<string, object>
                {
                    ["场馆"] = g.First().EventItem!.Venue?.Name ?? string.Empty,
                    ["活动数"] = g.Select(s => s.EventId).Distinct().Count().ToString(),
                    ["售票数"] = g.Sum(s => s.QuantitySold).ToString(),
                    ["营收"] = g.Sum(s => s.Revenue).ToString("F2"),
                    ["占比"] = sales.Sum(s => s.Revenue) > 0
                        ? $"{g.Sum(s => s.Revenue) / sales.Sum(s => s.Revenue) * 100:F2}%"
                        : "N/A"
                }).ToList();

            var byTypeData = sales
                .GroupBy(s => s.EventItem!.Type)
                .Select(g => new Dictionary<string, object>
                {
                    ["活动类型"] = g.Key,
                    ["活动数"] = g.Select(s => s.EventId).Distinct().Count().ToString(),
                    ["售票数"] = g.Sum(s => s.QuantitySold).ToString(),
                    ["营收"] = g.Sum(s => s.Revenue).ToString("F2"),
                    ["占比"] = sales.Sum(s => s.Revenue) > 0
                        ? $"{g.Sum(s => s.Revenue) / sales.Sum(s => s.Revenue) * 100:F2}%"
                        : "N/A"
                }).ToList();

            var allReportData = new List<Dictionary<string, object>>();
            allReportData.Add(new() { ["项目"] = "=== 月度营收汇总 ===", ["数值"] = "" });
            allReportData.AddRange(summaryData);
            allReportData.Add(new() { ["项目"] = "", ["数值"] = "" });
            allReportData.Add(new() { ["项目"] = "=== 销售明细 ===", ["数值"] = "" });
            allReportData.Add(new()
            {
                ["项目"] = string.Join(",", detailData.First().Keys),
                ["数值"] = ""
            });
            foreach (var row in detailData)
            {
                allReportData.Add(new()
                {
                    ["项目"] = string.Join(",", row.Values),
                    ["数值"] = ""
                });
            }
            allReportData.Add(new() { ["项目"] = "", ["数值"] = "" });
            allReportData.Add(new() { ["项目"] = "=== 按场馆统计 ===", ["数值"] = "" });
            allReportData.Add(new()
            {
                ["项目"] = string.Join(",", byVenueData.First().Keys),
                ["数值"] = ""
            });
            foreach (var row in byVenueData)
            {
                allReportData.Add(new()
                {
                    ["项目"] = string.Join(",", row.Values),
                    ["数值"] = ""
                });
            }
            allReportData.Add(new() { ["项目"] = "", ["数值"] = "" });
            allReportData.Add(new() { ["项目"] = "=== 按活动类型统计 ===", ["数值"] = "" });
            allReportData.Add(new()
            {
                ["项目"] = string.Join(",", byTypeData.First().Keys),
                ["数值"] = ""
            });
            foreach (var row in byTypeData)
            {
                allReportData.Add(new()
                {
                    ["项目"] = string.Join(",", row.Values),
                    ["数值"] = ""
                });
            }

            byte[] fileBytes;
            using (var memoryStream = new MemoryStream())
            using (var writer = new StreamWriter(memoryStream, new UTF8Encoding(true)))
            {
                var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    Delimiter = ",",
                    HasHeaderRecord = true
                };
                using (var csv = new CsvWriter(writer, csvConfig))
                {
                    await csv.WriteRecordsAsync(allReportData);
                }
                await writer.FlushAsync();
                fileBytes = memoryStream.ToArray();
            }

            await _redis.StringSetAsync(cacheKey,
                Convert.ToBase64String(fileBytes),
                TimeSpan.FromHours(6));

            _logger.LogInformation("月度营收报表生成成功，年份: {Year}，月份: {Month}，格式: {Format}，数据量: {Count}行，耗时: {Elapsed}ms",
                year, month, format, allReportData.Count, stopwatch.ElapsedMilliseconds);

            return fileBytes;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "生成月度营收报表失败，年份: {Year}，月份: {Month}", year, month);
            throw new InvalidOperationException("生成月度营收报表失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
