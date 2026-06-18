using WaterManagement.API.Data;
using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Services;

public class TelemetryBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelemetryBackgroundService> _logger;
    private readonly int _pushIntervalMinutes;

    public TelemetryBackgroundService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<TelemetryBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
        _pushIntervalMinutes = int.TryParse(_configuration.GetValue<string?>("Telemetry:PushIntervalMinutes"), out var interval)
            ? interval : 10;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Telemetry Background Service is starting. Interval: {Interval} minutes", _pushIntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PushTelemetryDataAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while pushing telemetry data");
            }

            await Task.Delay(TimeSpan.FromMinutes(_pushIntervalMinutes), stoppingToken);
        }

        _logger.LogInformation("Telemetry Background Service is stopping.");
    }

    private async Task PushTelemetryDataAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMongoDbContext>();

        _logger.LogInformation("Starting telemetry data push at {Time}", DateTime.UtcNow);

        var reservoirs = await db.Reservoirs.Find(_ => true).ToListAsync(cancellationToken);
        var rainfallStations = await db.RainfallStations.Find(_ => true).ToListAsync(cancellationToken);

        var readings = new List<WaterLevelReading>();
        var timestamp = DateTime.UtcNow;

        foreach (var reservoir in reservoirs)
        {
            var previous = await db.WaterLevelReadings
                .Find(r => r.StationId == reservoir.Id && r.StationType == "reservoir")
                .SortByDescending(r => r.Timestamp)
                .FirstOrDefaultAsync(cancellationToken);

            var reading = GenerateReservoirReading(reservoir, previous, timestamp);
            readings.Add(reading);
        }

        foreach (var station in rainfallStations)
        {
            var previous = await db.WaterLevelReadings
                .Find(r => r.StationId == station.Id && r.StationType == "rainfall")
                .SortByDescending(r => r.Timestamp)
                .FirstOrDefaultAsync(cancellationToken);

            var reading = GenerateRainfallReading(station, previous, timestamp);
            readings.Add(reading);
        }

        if (readings.Count > 0)
        {
            await db.WaterLevelReadings.InsertManyAsync(readings, cancellationToken: cancellationToken);
            _logger.LogInformation("Pushed {Count} telemetry readings at {Time}", readings.Count, timestamp);
        }

        await CheckOverdueDispatchOrdersAsync(db, cancellationToken);
    }

    private static WaterLevelReading GenerateReservoirReading(
        Reservoir reservoir,
        WaterLevelReading? previous,
        DateTime timestamp)
    {
        double baseLevel = previous?.WaterLevel ?? reservoir.FloodLimitLevel;
        double randomChange = (Random.Shared.NextDouble() - 0.5) * 0.15;
        double trend = 0.02;
        double newLevel = Math.Max(reservoir.DeadLevel, Math.Min(reservoir.DangerLevel + 2, baseLevel + randomChange + trend));

        double baseInflow = previous?.Inflow ?? 120;
        double inflow = Math.Max(0, baseInflow + (Random.Shared.NextDouble() - 0.5) * 40);

        double baseOutflow = previous?.Outflow ?? 100;
        double outflow = Math.Max(0, baseOutflow + (Random.Shared.NextDouble() - 0.5) * 20);

        double storage = reservoir.Capacity * (newLevel - reservoir.DeadLevel) /
            (reservoir.NormalPoolLevel - reservoir.DeadLevel);

        bool isWarning = newLevel >= reservoir.WarningLevel;
        bool isDanger = newLevel >= reservoir.DangerLevel;

        return new WaterLevelReading
        {
            StationId = reservoir.Id,
            StationCode = reservoir.Code,
            StationName = reservoir.Name,
            StationType = "reservoir",
            Timestamp = timestamp,
            WaterLevel = Math.Round(newLevel, 3),
            Inflow = Math.Round(inflow, 2),
            Outflow = Math.Round(outflow, 2),
            Storage = Math.Round(storage, 2),
            IsWarning = isWarning,
            IsDanger = isDanger,
            Source = "telemetry"
        };
    }

    private static WaterLevelReading GenerateRainfallReading(
        RainfallStation station,
        WaterLevelReading? previous,
        DateTime timestamp)
    {
        double rainfall = Math.Max(0, (Random.Shared.NextDouble() - 0.3) * 8);
        double cumulative = (previous?.CumulativeRainfall ?? 0) + rainfall;

        var hour = timestamp.Hour;
        if (hour >= 6 && hour <= 18)
        {
            rainfall *= 1.5;
            cumulative += rainfall * 0.5;
        }

        return new WaterLevelReading
        {
            StationId = station.Id,
            StationCode = station.Code,
            StationName = station.Name,
            StationType = "rainfall",
            Timestamp = timestamp,
            Rainfall = Math.Round(rainfall, 2),
            CumulativeRainfall = Math.Round(cumulative, 2),
            Source = "telemetry"
        };
    }

    private static async Task CheckOverdueDispatchOrdersAsync(IMongoDbContext db, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var filter = Builders<DispatchOrder>.Filter.And(
            Builders<DispatchOrder>.Filter.Ne(o => o.Status, DispatchStatus.Confirmed),
            Builders<DispatchOrder>.Filter.Ne(o => o.Status, DispatchStatus.Closed),
            Builders<DispatchOrder>.Filter.Ne(o => o.Status, DispatchStatus.Cancelled),
            Builders<DispatchOrder>.Filter.Ne(o => o.Status, DispatchStatus.Overdue),
            Builders<DispatchOrder>.Filter.Lt(o => o.ConfirmDeadline, now)
        );

        var update = Builders<DispatchOrder>.Update
            .Set(o => o.Status, DispatchStatus.Overdue)
            .Set(o => o.UpdatedAt, now)
            .Push(o => o.TraceLogs, new DispatchTraceLog
            {
                Timestamp = now,
                Status = DispatchStatus.Overdue,
                Remark = "系统自动标记为超期"
            });

        var result = await db.DispatchOrders.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);

        if (result.ModifiedCount > 0)
        {
            // logger would go here
        }
    }
}
