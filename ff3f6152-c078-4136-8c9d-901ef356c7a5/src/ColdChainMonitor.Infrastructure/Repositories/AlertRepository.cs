using MongoDB.Driver;
using MongoDB.Bson;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class AlertRepository : MongoRepositoryBase<Alert>, IAlertRepository
{
    public AlertRepository(MongoDbContext context)
        : base(context, context.Alerts)
    {
    }

    public async Task<Alert?> GetByAlertNoAsync(string alertNo)
    {
        var filter = Builders<Alert>.Filter.Eq(a => a.AlertNo, alertNo);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<CursorPagedResult<Alert>> GetPagedAsync(
        AlertLevel? alertLevel,
        AlertType? alertType,
        bool? isAcknowledged,
        bool? isResolved,
        string? deviceId,
        string? transportTaskId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true)
    {
        var filterBuilder = Builders<Alert>.Filter;
        var filters = new List<FilterDefinition<Alert>>();

        if (alertLevel.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.AlertLevel, alertLevel.Value));
        }

        if (alertType.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.AlertType, alertType.Value));
        }

        if (isAcknowledged.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.IsAcknowledged, isAcknowledged.Value));
        }

        if (isResolved.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.IsResolved, isResolved.Value));
        }

        if (!string.IsNullOrEmpty(deviceId))
        {
            filters.Add(filterBuilder.Eq(a => a.DeviceId, deviceId));
        }

        if (!string.IsNullOrEmpty(transportTaskId))
        {
            filters.Add(filterBuilder.Eq(a => a.TransportTaskId, transportTaskId));
        }

        if (startTime.HasValue)
        {
            filters.Add(filterBuilder.Gte(a => a.CreatedAt, startTime.Value));
        }

        if (endTime.HasValue)
        {
            filters.Add(filterBuilder.Lte(a => a.CreatedAt, endTime.Value));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sort = sortDesc
            ? Builders<Alert>.Sort.Descending(a => a.CreatedAt)
            : Builders<Alert>.Sort.Ascending(a => a.CreatedAt);

        var find = _collection.Find(filter).Sort(sort);

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorId = ObjectId.Parse(cursor);
            find = sortDesc
                ? find.Filter(filterBuilder.Lt(a => a.Id, cursorId.ToString()))
                : find.Filter(filterBuilder.Gt(a => a.Id, cursorId.ToString()));
        }

        var items = await find.Limit(limit + 1).ToListAsync();
        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Id
            : null;

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<Alert>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }

    public async Task<Alert?> GetActiveAlertByDeviceAndTypeAsync(string deviceId, AlertType alertType)
    {
        var filter = Builders<Alert>.Filter.And(
            Builders<Alert>.Filter.Eq(a => a.DeviceId, deviceId),
            Builders<Alert>.Filter.Eq(a => a.AlertType, alertType),
            Builders<Alert>.Filter.Eq(a => a.IsResolved, false)
        );
        var sort = Builders<Alert>.Sort.Descending(a => a.CreatedAt);
        return await _collection.Find(filter).Sort(sort).FirstOrDefaultAsync();
    }

    public async Task IncrementAlertTriggerAsync(string alertId, DateTime lastTriggeredAt)
    {
        var filter = Builders<Alert>.Filter.Eq(a => a.Id, alertId);
        var update = Builders<Alert>.Update
            .Set(a => a.LastTriggeredAt, lastTriggeredAt)
            .Inc(a => a.TriggerCount, 1);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task AcknowledgeAsync(string alertId, string userId, string userName, string remark)
    {
        var filter = Builders<Alert>.Filter.Eq(a => a.Id, alertId);
        var update = Builders<Alert>.Update
            .Set(a => a.IsAcknowledged, true)
            .Set(a => a.AcknowledgedBy, userId)
            .Set(a => a.AcknowledgedByName, userName)
            .Set(a => a.AcknowledgedAt, DateTime.UtcNow)
            .Set(a => a.AcknowledgeRemark, remark);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task ResolveAsync(string alertId, string userId, string userName, string remark)
    {
        var filter = Builders<Alert>.Filter.Eq(a => a.Id, alertId);
        var update = Builders<Alert>.Update
            .Set(a => a.IsResolved, true)
            .Set(a => a.ResolvedBy, userId)
            .Set(a => a.ResolvedByName, userName)
            .Set(a => a.ResolvedAt, DateTime.UtcNow)
            .Set(a => a.ResolveRemark, remark);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task<int> GetUnacknowledgedCountAsync()
    {
        var filter = Builders<Alert>.Filter.Eq(a => a.IsAcknowledged, false);
        var count = await _collection.CountDocumentsAsync(filter);
        return (int)count;
    }

    public async Task<List<AlertTypeCount>> GetAlertTypeStatsAsync(DateTime startTime, DateTime endTime)
    {
        var filter = Builders<Alert>.Filter.And(
            Builders<Alert>.Filter.Gte(a => a.CreatedAt, startTime),
            Builders<Alert>.Filter.Lte(a => a.CreatedAt, endTime)
        );

        var result = await _collection.Aggregate()
            .Match(filter)
            .Group(a => a.AlertType, g => new { AlertType = g.Key, Count = g.Count() })
            .ToListAsync();

        return result.Select(r => new AlertTypeCount
        {
            AlertType = r.AlertType,
            Count = (int)r.Count
        }).ToList();
    }
}
