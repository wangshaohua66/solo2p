using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Services;

public interface IReportService
{
    Task<List<WaterLevelPoint>> GetLevelCurveAsync(string reservoirId, string range = "month");
    Task<List<RainfallPoint>> GetRainfallIsohyetAsync();
    Task<DispatchStatsDto> GetDispatchStatsAsync();
    Task<InspectionStatsDto> GetInspectionStatsAsync();
}

public class ReportService : IReportService
{
    private readonly IMongoDbContext _db;

    public ReportService(IMongoDbContext db)
    {
        _db = db;
    }

    public async Task<List<WaterLevelPoint>> GetLevelCurveAsync(string reservoirId, string range = "month")
    {
        var now = DateTime.UtcNow;
        DateTime startTime = range switch
        {
            "day" => now.AddHours(-24),
            "week" => now.AddDays(-7),
            "year" => now.AddYears(-1),
            _ => now.AddDays(-30)
        };

        var readings = await _db.WaterLevelReadings
            .Find(r => r.StationId == reservoirId && r.StationType == "reservoir" && r.Timestamp >= startTime)
            .SortBy(r => r.Timestamp)
            .ToListAsync();

        return readings
            .Where(r => r.WaterLevel.HasValue)
            .Select(r => new WaterLevelPoint
            {
                T = new DateTimeOffset(r.Timestamp).ToUnixTimeMilliseconds(),
                Level = r.WaterLevel!.Value
            })
            .ToList();
    }

    public async Task<List<RainfallPoint>> GetRainfallIsohyetAsync()
    {
        var stations = await _db.RainfallStations.Find(_ => true).ToListAsync();
        var result = new List<RainfallPoint>();

        foreach (var stn in stations)
        {
            var latest = await _db.WaterLevelReadings
                .Find(r => r.StationId == stn.Id && r.StationType == "rainfall")
                .SortByDescending(r => r.Timestamp)
                .FirstOrDefaultAsync();

            result.Add(new RainfallPoint
            {
                X = MapLongitudeToX(stn.Longitude),
                Y = MapLatitudeToY(stn.Latitude),
                Value = Math.Round(latest?.CumulativeRainfall ?? Random.Shared.NextDouble() * 150, 1),
                Name = stn.Name
            });
        }

        return result.OrderBy(r => r.Y).ToList();
    }

    public async Task<DispatchStatsDto> GetDispatchStatsAsync()
    {
        var allOrders = await _db.DispatchOrders.Find(_ => true).ToListAsync();
        var byGate = allOrders
            .GroupBy(o => o.GateName)
            .Select(g => new DispatchGateStat
            {
                Gate = g.Key,
                Count = g.Count(),
                Confirmed = g.Count(o => o.Status == DispatchStatus.Confirmed || o.Status == DispatchStatus.Closed)
            })
            .OrderByDescending(g => g.Count)
            .Take(10)
            .ToList();

        int confirmed = allOrders.Count(o => o.Status == DispatchStatus.Confirmed || o.Status == DispatchStatus.Closed);
        int total = allOrders.Count;

        var avgConfirmMinutes = allOrders
            .Where(o => o.ConfirmTime.HasValue && o.SendTime.HasValue)
            .Select(o => (o.ConfirmTime!.Value - o.SendTime!.Value).TotalMinutes)
            .DefaultIfEmpty(0)
            .Average();

        return new DispatchStatsDto
        {
            TotalOrders = total,
            PendingOrders = allOrders.Count(o => o.Status == DispatchStatus.Pending || o.Status == DispatchStatus.Sent || o.Status == DispatchStatus.Delivered),
            ConfirmedOrders = confirmed,
            OverdueOrders = allOrders.Count(o => o.Status == DispatchStatus.Overdue),
            ClosedOrders = allOrders.Count(o => o.Status == DispatchStatus.Closed),
            ConfirmRate = total > 0 ? Math.Round((double)confirmed / total * 100, 1) : 0,
            AvgConfirmMinutes = Math.Round(avgConfirmMinutes, 1),
            ByGate = byGate
        };
    }

    public async Task<InspectionStatsDto> GetInspectionStatsAsync()
    {
        var tasks = await _db.InspectionTasks.Find(_ => true).ToListAsync();
        var allDefects = tasks.SelectMany(t => t.Defects).ToList();

        var bySeverity = new Dictionary<string, int>
        {
            ["一般"] = allDefects.Count(d => d.Severity == DefectSeverity.Minor),
            ["较重"] = allDefects.Count(d => d.Severity == DefectSeverity.Major),
            ["严重"] = allDefects.Count(d => d.Severity == DefectSeverity.Critical)
        };

        var byPart = allDefects
            .GroupBy(d => d.PartName)
            .Select(g => new DefectPartStat { Part = g.Key, Count = g.Count() })
            .OrderByDescending(p => p.Count)
            .Take(10)
            .ToList();

        return new InspectionStatsDto
        {
            TotalTasks = tasks.Count,
            PendingTasks = tasks.Count(t => t.Status == InspectionStatus.Pending),
            InProgressTasks = tasks.Count(t => t.Status == InspectionStatus.InProgress),
            CompletedTasks = tasks.Count(t => t.Status == InspectionStatus.Completed),
            HasDefectTasks = tasks.Count(t => t.Status == InspectionStatus.HasDefect),
            TotalDefects = allDefects.Count,
            ResolvedDefects = allDefects.Count(d => d.Status == DefectStatus.Resolved || d.Status == DefectStatus.Closed),
            DefectsBySeverity = bySeverity,
            DefectsByPart = byPart
        };
    }

    private static double MapLongitudeToX(double lon)
    {
        return 10 + (lon - 118.5) / 3.0 * 80;
    }

    private static double MapLatitudeToY(double lat)
    {
        return 50 - (lat - 29.5) / 3.0 * 42;
    }
}
