using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using MongoDB.Driver;
using System.Diagnostics;

namespace WaterManagement.API.Services;

public interface IFloodSimulationService
{
    Task<FloodSimulationResult> SimulateAsync(FloodSimulationParams parameters);
}

public class FloodSimulationService : IFloodSimulationService
{
    private readonly IMongoDbContext _db;

    public FloodSimulationService(IMongoDbContext db)
    {
        _db = db;
    }

    public async Task<FloodSimulationResult> SimulateAsync(FloodSimulationParams parameters)
    {
        var stopwatch = Stopwatch.StartNew();

        var reservoir = await _db.Reservoirs
            .Find(r => r.Id == parameters.ReservoirId)
            .FirstOrDefaultAsync();

        if (reservoir == null)
            throw new KeyNotFoundException("Reservoir not found");

        var timestamps = new List<DateTime>();
        var now = DateTime.UtcNow;
        int totalSteps = parameters.SimulationHours * 60 / parameters.TimeStepMinutes;

        for (int i = 0; i <= totalSteps; i++)
        {
            timestamps.Add(now.AddMinutes(i * parameters.TimeStepMinutes));
        }

        var distances = parameters.DownstreamDistances ?? new double[] { 5, 15, 30, 50 };
        var sections = new List<FloodSectionResult>();

        for (int i = 0; i < distances.Length; i++)
        {
            var section = SimulateSection(
                reservoir.Name + "下游" + distances[i] + "km",
                distances[i],
                parameters.CurrentWaterLevel,
                parameters.InflowRate,
                parameters.OutflowRate,
                timestamps);
            sections.Add(section);
        }

        stopwatch.Stop();

        return new FloodSimulationResult
        {
            ReservoirId = parameters.ReservoirId,
            Timestamps = timestamps,
            Sections = sections,
            ComputationTimeMs = stopwatch.Elapsed.TotalMilliseconds
        };
    }

    private FloodSectionResult SimulateSection(
        string sectionName,
        double distanceKm,
        double initialLevel,
        double inflowRate,
        double outflowRate,
        List<DateTime> timestamps)
    {
        var levels = new List<double>();
        double peakLevel = initialLevel;
        DateTime peakTime = timestamps[0];

        double travelTimeHours = distanceKm * 0.8;
        double travelSteps = travelTimeHours * 60 / 60;

        double attenuationFactor = Math.Max(0.3, 1.0 - distanceKm * 0.012);
        double baseRise = Math.Max(0, (inflowRate - outflowRate) * 0.008);

        for (int i = 0; i < timestamps.Count; i++)
        {
            double t = (double)i / timestamps.Count;
            double delayFactor = 1.0 / (1.0 + Math.Exp(-(i - travelSteps) * 0.3));
            double waveShape = Math.Sin(t * Math.PI) * baseRise * 2.5;
            double level = initialLevel + waveShape * attenuationFactor * delayFactor;
            level += baseRise * t * 0.3;
            level += Math.Sin(i * 0.15) * 0.02;

            levels.Add(Math.Round(level, 3));

            if (level > peakLevel)
            {
                peakLevel = level;
                peakTime = timestamps[i];
            }
        }

        return new FloodSectionResult
        {
            SectionName = sectionName,
            DistanceKm = distanceKm,
            WaterLevels = levels,
            PeakLevel = Math.Round(peakLevel, 3),
            PeakTime = peakTime
        };
    }
}
