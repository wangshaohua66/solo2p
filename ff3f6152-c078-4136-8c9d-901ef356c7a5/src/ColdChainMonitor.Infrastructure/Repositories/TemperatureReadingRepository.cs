using MongoDB.Driver;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class TemperatureReadingRepository : ITemperatureReadingRepository
{
    private readonly IMongoCollection<TemperatureReading> _collection;
    private readonly MongoDbContext _context;

    public TemperatureReadingRepository(MongoDbContext context)
    {
        _context = context;
        _collection = context.TemperatureReadings;
    }

    public async Task AddAsync(TemperatureReading reading)
    {
        await _collection.InsertOneAsync(reading);
    }

    public async Task AddBatchAsync(List<TemperatureReading> readings)
    {
        if (readings.Count == 0) return;
        await _collection.InsertManyAsync(readings);
    }

    public async Task<List<TemperatureReading>> GetByDeviceAndTimeRangeAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime,
        int limit = 1000)
    {
        var filter = Builders<TemperatureReading>.Filter.And(
            Builders<TemperatureReading>.Filter.Eq(r => r.DeviceId, deviceId),
            Builders<TemperatureReading>.Filter.Gte(r => r.Timestamp, startTime),
            Builders<TemperatureReading>.Filter.Lte(r => r.Timestamp, endTime)
        );

        var sort = Builders<TemperatureReading>.Sort.Ascending(r => r.Timestamp);

        return await _collection.Find(filter)
            .Sort(sort)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<CursorPagedResult<TemperatureReading>> GetPagedByDeviceAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime,
        string? cursor,
        int limit)
    {
        var filterBuilder = Builders<TemperatureReading>.Filter;
        var filters = new List<FilterDefinition<TemperatureReading>>
        {
            filterBuilder.Eq(r => r.DeviceId, deviceId),
            filterBuilder.Gte(r => r.Timestamp, startTime),
            filterBuilder.Lte(r => r.Timestamp, endTime)
        };

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorTime = DateTime.Parse(cursor);
            filters.Add(filterBuilder.Gt(r => r.Timestamp, cursorTime));
        }

        var filter = filterBuilder.And(filters);
        var sort = Builders<TemperatureReading>.Sort.Ascending(r => r.Timestamp);

        var items = await _collection.Find(filter)
            .Sort(sort)
            .Limit(limit + 1)
            .ToListAsync();

        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Timestamp.ToString("o")
            : null;

        var totalCount = await _collection.CountDocumentsAsync(
            filterBuilder.And(
                filterBuilder.Eq(r => r.DeviceId, deviceId),
                filterBuilder.Gte(r => r.Timestamp, startTime),
                filterBuilder.Lte(r => r.Timestamp, endTime)
            ));

        return new CursorPagedResult<TemperatureReading>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }

    public async Task<TemperatureReading?> GetLatestByDeviceIdAsync(string deviceId)
    {
        var filter = Builders<TemperatureReading>.Filter.Eq(r => r.DeviceId, deviceId);
        var sort = Builders<TemperatureReading>.Sort.Descending(r => r.Timestamp);
        return await _collection.Find(filter).Sort(sort).FirstOrDefaultAsync();
    }

    public async Task<List<TemperatureReading>> GetLatestByDeviceIdsAsync(List<string> deviceIds)
    {
        var results = new List<TemperatureReading>();
        foreach (var deviceId in deviceIds)
        {
            var latest = await GetLatestByDeviceIdAsync(deviceId);
            if (latest != null)
            {
                results.Add(latest);
            }
        }
        return results;
    }

    public async Task<(double avg, double max, double min, long total, long anomaly)> GetStatsAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime)
    {
        var filter = Builders<TemperatureReading>.Filter.And(
            Builders<TemperatureReading>.Filter.Eq(r => r.DeviceId, deviceId),
            Builders<TemperatureReading>.Filter.Gte(r => r.Timestamp, startTime),
            Builders<TemperatureReading>.Filter.Lte(r => r.Timestamp, endTime)
        );

        var total = await _collection.CountDocumentsAsync(filter);
        if (total == 0)
        {
            return (0, 0, 0, 0, 0);
        }

        var anomalyCount = await _collection.CountDocumentsAsync(
            Builders<TemperatureReading>.Filter.And(
                filter,
                Builders<TemperatureReading>.Filter.Eq(r => r.IsAnomaly, true)
            ));

        var group = new BsonDocument
        {
            { "_id", null },
            { "avgTemp", new BsonDocument("$avg", "$temperature") },
            { "maxTemp", new BsonDocument("$max", "$temperature") },
            { "minTemp", new BsonDocument("$min", "$temperature") }
        };

        var pipeline = new[]
        {
            PipelineStageDefinitionBuilder.Match(filter),
            PipelineStageDefinitionBuilder.Group<BsonDocument>(group)
        };

        var result = await _collection.Aggregate()
            .Match(filter)
            .Group(r => 1, g => new
            {
                AvgTemp = g.Average(r => r.Temperature),
                MaxTemp = g.Max(r => r.Temperature),
                MinTemp = g.Min(r => r.Temperature)
            })
            .FirstOrDefaultAsync();

        if (result == null)
        {
            return (0, 0, 0, total, anomalyCount);
        }

        return (result.AvgTemp, result.MaxTemp, result.MinTemp, total, anomalyCount);
    }

    public async Task<long> CountByDeviceAndTimeRangeAsync(string deviceId, DateTime startTime, DateTime endTime)
    {
        var filter = Builders<TemperatureReading>.Filter.And(
            Builders<TemperatureReading>.Filter.Eq(r => r.DeviceId, deviceId),
            Builders<TemperatureReading>.Filter.Gte(r => r.Timestamp, startTime),
            Builders<TemperatureReading>.Filter.Lte(r => r.Timestamp, endTime)
        );
        return await _collection.CountDocumentsAsync(filter);
    }
}
