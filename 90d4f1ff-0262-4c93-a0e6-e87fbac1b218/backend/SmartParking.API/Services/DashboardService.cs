using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(AppDbContext db, IMapper mapper, ILogger<DashboardService> logger)
    {
        _db = db;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ApiResponse<DashboardStatsDto>> GetStatsAsync(string period = "day")
    {
        try
        {
            var now = DateTime.UtcNow;
            var todayStart = now.Date;
            var yesterdayStart = todayStart.AddDays(-1);
            var weekStart = todayStart.AddDays(-7);
            var monthStart = new DateTime(now.Year, now.Month, 1);

            var todayOrders = await _db.PaymentOrders
                .Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= todayStart)
                .SumAsync(o => o.Amount);

            var yesterdayOrders = await _db.PaymentOrders
                .Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= yesterdayStart && o.PaidAt < todayStart)
                .SumAsync(o => o.Amount);

            var weekOrders = await _db.PaymentOrders
                .Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= weekStart)
                .SumAsync(o => o.Amount);

            var monthOrders = await _db.PaymentOrders
                .Where(o => o.Status == OrderStatus.Paid && o.PaidAt >= monthStart)
                .SumAsync(o => o.Amount);

            var totalParkings = await _db.ParkingRecords
                .CountAsync(r => r.EntryTime >= todayStart);

            var totalChargings = await _db.ChargingSessions
                .CountAsync(s => s.StartTime >= todayStart);

            var avgDurationQuery = _db.ParkingRecords
                .Where(r => r.Status == "Completed" && r.EntryTime >= todayStart && r.DurationMinutes.HasValue);

            var avgDuration = await avgDurationQuery.AnyAsync()
                ? await avgDurationQuery.AverageAsync(r => r.DurationMinutes.Value)
                : 0;

            var totalSpots = await _db.ParkingSpots.CountAsync(s => s.Status != ParkingSpotStatus.Offline);
            var occupiedSpots = await _db.ParkingSpots.CountAsync(s =>
                s.Status == ParkingSpotStatus.Occupied || s.Status == ParkingSpotStatus.Reserved);
            var occupancyRate = totalSpots > 0 ? Math.Round((decimal)occupiedSpots / totalSpots * 100, 2) : 0;

            var totalStations = await _db.ChargingStations.CountAsync(s => s.Status != ChargingStationStatus.Offline);
            var activeStations = await _db.ChargingStations.CountAsync(s => s.Status == ChargingStationStatus.Charging);
            var chargingUtil = totalStations > 0 ? Math.Round((decimal)activeStations / totalStations * 100, 2) : 0;

            var peakHours = GeneratePeakHours();
            var revenueTrend = GenerateTrendData(7, 3000, 8000);
            var parkingTrend = GenerateTrendData(7, 100, 500, true);
            var chargingTrend = GenerateTrendData(7, 50, 200, true);

            var topLots = GenerateRankingData(5, "停车场", 200, 800, true);
            var topStations = GenerateRankingData(5, "充电桩", 50, 300, false);

            return ApiResponse<DashboardStatsDto>.Success(new DashboardStatsDto
            {
                TodayRevenue = Math.Round(todayOrders, 2),
                YesterdayRevenue = Math.Round(yesterdayOrders, 2),
                WeekRevenue = Math.Round(weekOrders, 2),
                MonthRevenue = Math.Round(monthOrders, 2),
                TotalParkings = totalParkings,
                TotalChargings = totalChargings,
                AvgParkingDuration = Math.Round(avgDuration, 2),
                OccupancyRate = occupancyRate,
                ChargingUtilization = chargingUtil,
                PeakHours = peakHours,
                RevenueTrend = revenueTrend,
                ParkingTrend = parkingTrend,
                ChargingTrend = chargingTrend,
                TopParkingLots = topLots,
                TopStations = topStations
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取看板数据失败");
            return ApiResponse<DashboardStatsDto>.Error("获取数据失败");
        }
    }

    private static List<PeakHourDto> GeneratePeakHours()
    {
        return Enumerable.Range(0, 24).Select(h => new PeakHourDto
        {
            Hour = h,
            Count = h >= 8 && h <= 10 ? Random.Shared.Next(40, 80)
                  : h >= 17 && h <= 20 ? Random.Shared.Next(50, 90)
                  : h >= 0 && h <= 6 ? Random.Shared.Next(2, 15)
                  : Random.Shared.Next(15, 40)
        }).ToList();
    }

    private static List<TrendDataDto> GenerateTrendData(int days, decimal min, decimal max, bool isInt = false)
    {
        var result = new List<TrendDataDto>();
        for (int i = days - 1; i >= 0; i--)
        {
            var date = DateTime.Now.AddDays(-i);
            var value = isInt
                ? Random.Shared.Next((int)min, (int)max + 1)
                : Math.Round(min + (decimal)(Random.Shared.NextDouble() * (double)(max - min)), 2);
            var compare = isInt
                ? Random.Shared.Next((int)min, (int)max + 1)
                : Math.Round(min + (decimal)(Random.Shared.NextDouble() * (double)(max - min)), 2);

            result.Add(new TrendDataDto
            {
                Date = $"{date.Month}/{date.Day}",
                Value = value,
                CompareValue = compare
            });
        }
        return result;
    }

    private static List<RankingDataDto> GenerateRankingData(int count, string prefix, decimal min, decimal max, bool isInt)
    {
        var result = new List<RankingDataDto>();
        for (int i = 0; i < count; i++)
        {
            var value = isInt
                ? Random.Shared.Next((int)min, (int)max + 1)
                : Math.Round(min + (decimal)(Random.Shared.NextDouble() * (double)(max - min)), 1);

            result.Add(new RankingDataDto
            {
                Id = $"rank-{i + 1}",
                Name = $"{prefix}TOP{i + 1}",
                Value = value
            });
        }
        return result.OrderByDescending(r => r.Value).ToList();
    }
}
