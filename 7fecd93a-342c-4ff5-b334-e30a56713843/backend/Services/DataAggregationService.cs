using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Services;

public interface IDataAggregationService
{
    Task<WarningSummaryDto> GetWarningsAsync();
    Task<List<StationOverviewDto>> GetOverviewAsync();
    Task<StationOverviewDto?> GetStationOverviewAsync(string stationId);
    Task<StationOverviewDto?> GetStationOverviewByCodeAsync(string stationCode);
}

public class DataAggregationService : IDataAggregationService
{
    private readonly IMongoDbContext _db;

    public DataAggregationService(IMongoDbContext db)
    {
        _db = db;
    }

    public async Task<WarningSummaryDto> GetWarningsAsync()
    {
        var reservoirs = await _db.Reservoirs.Find(_ => true).ToListAsync();
        var stations = await _db.RainfallStations.Find(_ => true).ToListAsync();

        var reservoirIds = reservoirs.Select(r => r.Id).ToList();
        var latestReadingsDict = new Dictionary<string, WaterLevelReading>();

        if (reservoirIds.Count > 0)
        {
            var readingsFilter = Builders<WaterLevelReading>.Filter.In(r => r.StationId, reservoirIds);
            var allReadings = await _db.WaterLevelReadings
                .Find(readingsFilter)
                .SortByDescending(r => r.Timestamp)
                .ToListAsync();

            latestReadingsDict = allReadings
                .GroupBy(r => r.StationId)
                .ToDictionary(g => g.Key, g => g.First());
        }

        var warnings = new List<StationWarningDto>();
        int warningCount = 0, dangerCount = 0, normalCount = 0;

        foreach (var res in reservoirs)
        {
            latestReadingsDict.TryGetValue(res.Id, out var latest);

            if (latest?.WaterLevel.HasValue == true)
            {
                if (latest.WaterLevel >= res.DangerLevel)
                {
                    dangerCount++;
                    warnings.Add(new StationWarningDto
                    {
                        StationId = res.Id,
                        StationName = res.Name,
                        WarningLevel = "danger",
                        CurrentLevel = latest.WaterLevel.Value,
                        Threshold = res.DangerLevel,
                        TriggerTime = latest.Timestamp
                    });
                }
                else if (latest.WaterLevel >= res.WarningLevel)
                {
                    warningCount++;
                    warnings.Add(new StationWarningDto
                    {
                        StationId = res.Id,
                        StationName = res.Name,
                        WarningLevel = "warning",
                        CurrentLevel = latest.WaterLevel.Value,
                        Threshold = res.WarningLevel,
                        TriggerTime = latest.Timestamp
                    });
                }
                else
                {
                    normalCount++;
                }
            }
            else
            {
                normalCount++;
            }
        }

        return new WarningSummaryDto
        {
            TotalStations = reservoirs.Count + stations.Count,
            WarningStations = warningCount,
            DangerStations = dangerCount,
            NormalStations = normalCount + stations.Count,
            Warnings = warnings.OrderByDescending(w => w.WarningLevel).ToList()
        };
    }

    public async Task<List<StationOverviewDto>> GetOverviewAsync()
    {
        var reservoirs = await _db.Reservoirs.Find(_ => true).ToListAsync();
        var rainfallStations = await _db.RainfallStations.Find(_ => true).ToListAsync();

        var allStationIds = reservoirs.Select(r => r.Id)
            .Concat(rainfallStations.Select(s => s.Id))
            .ToList();

        var latestReadingsDict = new Dictionary<string, WaterLevelReading>();

        if (allStationIds.Count > 0)
        {
            var readingsFilter = Builders<WaterLevelReading>.Filter.In(r => r.StationId, allStationIds);
            var allReadings = await _db.WaterLevelReadings
                .Find(readingsFilter)
                .SortByDescending(r => r.Timestamp)
                .ToListAsync();

            latestReadingsDict = allReadings
                .GroupBy(r => r.StationId)
                .ToDictionary(g => g.Key, g => g.First());
        }

        var result = new List<StationOverviewDto>();

        foreach (var res in reservoirs)
        {
            latestReadingsDict.TryGetValue(res.Id, out var latest);

            var dto = new StationOverviewDto
            {
                Id = res.Id,
                Code = res.Code,
                Name = res.Name,
                Type = "reservoir",
                Longitude = res.Longitude,
                Latitude = res.Latitude,
                WarningLevel = res.WarningLevel,
                DangerLevel = res.DangerLevel,
                Status = "normal",
                LastUpdate = latest?.Timestamp
            };

            if (latest != null)
            {
                dto.CurrentWaterLevel = latest.WaterLevel;
                dto.Inflow = latest.Inflow;
                dto.Outflow = latest.Outflow;
                dto.Rainfall = latest.Rainfall;
                dto.CumulativeRainfall = latest.CumulativeRainfall;

                if (latest.WaterLevel >= res.DangerLevel)
                    dto.Status = "danger";
                else if (latest.WaterLevel >= res.WarningLevel)
                    dto.Status = "warning";
            }

            result.Add(dto);
        }

        foreach (var stn in rainfallStations)
        {
            latestReadingsDict.TryGetValue(stn.Id, out var latest);

            var dto = new StationOverviewDto
            {
                Id = stn.Id,
                Code = stn.Code,
                Name = stn.Name,
                Type = "rainfall",
                Longitude = stn.Longitude,
                Latitude = stn.Latitude,
                LastUpdate = latest?.Timestamp
            };

            if (latest != null)
            {
                dto.Rainfall = latest.Rainfall;
                dto.CumulativeRainfall = latest.CumulativeRainfall;
            }

            result.Add(dto);
        }

        return result;
    }

    public async Task<StationOverviewDto?> GetStationOverviewAsync(string stationId)
    {
        var overview = await GetOverviewAsync();
        return overview.FirstOrDefault(s => s.Id == stationId);
    }

    public async Task<StationOverviewDto?> GetStationOverviewByCodeAsync(string stationCode)
    {
        var overview = await GetOverviewAsync();
        return overview.FirstOrDefault(s => s.Code == stationCode);
    }
}
