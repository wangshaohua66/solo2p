using MongoDB.Driver;
using MongoDB.Bson;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class TransportTaskRepository : MongoRepositoryBase<TransportTask>, ITransportTaskRepository
{
    public TransportTaskRepository(MongoDbContext context)
        : base(context, context.TransportTasks)
    {
    }

    public async Task<TransportTask?> GetByTaskNoAsync(string taskNo)
    {
        var filter = Builders<TransportTask>.Filter.Eq(t => t.TaskNo, taskNo);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<CursorPagedResult<TransportTask>> GetPagedAsync(
        TransportStatus? status,
        string? keyword,
        string? vehicleId,
        string? driverId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true)
    {
        var filterBuilder = Builders<TransportTask>.Filter;
        var filters = new List<FilterDefinition<TransportTask>>();

        if (status.HasValue)
        {
            filters.Add(filterBuilder.Eq(t => t.Status, status.Value));
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            filters.Add(filterBuilder.Or(
                filterBuilder.Regex(t => t.TaskNo, new BsonRegularExpression(keyword, "i")),
                filterBuilder.Regex(t => t.DrugBatch.DrugName, new BsonRegularExpression(keyword, "i")),
                filterBuilder.Regex(t => t.DrugBatch.BatchNo, new BsonRegularExpression(keyword, "i"))
            ));
        }

        if (!string.IsNullOrEmpty(vehicleId))
        {
            filters.Add(filterBuilder.Eq(t => t.Vehicle.VehicleId, vehicleId));
        }

        if (!string.IsNullOrEmpty(driverId))
        {
            filters.Add(filterBuilder.Eq(t => t.Driver.DriverId, driverId));
        }

        if (startTime.HasValue)
        {
            filters.Add(filterBuilder.Gte(t => t.CreatedAt, startTime.Value));
        }

        if (endTime.HasValue)
        {
            filters.Add(filterBuilder.Lte(t => t.CreatedAt, endTime.Value));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sort = sortDesc
            ? Builders<TransportTask>.Sort.Descending(t => t.CreatedAt)
            : Builders<TransportTask>.Sort.Ascending(t => t.CreatedAt);

        var find = _collection.Find(filter).Sort(sort);

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorId = ObjectId.Parse(cursor);
            find = sortDesc
                ? find.Filter(filterBuilder.Lt(t => t.Id, cursorId.ToString()))
                : find.Filter(filterBuilder.Gt(t => t.Id, cursorId.ToString()));
        }

        var items = await find.Limit(limit + 1).ToListAsync();
        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Id
            : null;

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<TransportTask>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }

    public async Task UpdateStatusAsync(string id, TransportStatus status, StatusChangeRecord statusRecord)
    {
        var filter = Builders<TransportTask>.Filter.Eq(t => t.Id, id);
        var update = Builders<TransportTask>.Update
            .Set(t => t.Status, status)
            .Set(t => t.UpdatedAt, DateTime.UtcNow)
            .Push(t => t.StatusHistory, statusRecord);

        if (status == TransportStatus.InTransit)
        {
            update = update.Set(t => t.ActualDepartureAt, DateTime.UtcNow);
        }
        else if (status == TransportStatus.Arrived)
        {
            update = update.Set(t => t.ActualArrivalAt, DateTime.UtcNow);
        }

        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task<List<TransportTask>> GetActiveTasksByDeviceIdAsync(string deviceId)
    {
        var filter = Builders<TransportTask>.Filter.And(
            Builders<TransportTask>.Filter.AnyEq(t => t.DeviceIds, deviceId),
            Builders<TransportTask>.Filter.In(t => t.Status, new[]
            {
                TransportStatus.InTransit,
                TransportStatus.Arrived,
                TransportStatus.QualityChecking
            })
        );
        return await _collection.Find(filter).ToListAsync();
    }

    public async Task UpdateAlertCountAsync(string taskId, int alertCount, int criticalAlertCount)
    {
        var filter = Builders<TransportTask>.Filter.Eq(t => t.Id, taskId);
        var update = Builders<TransportTask>.Update
            .Set(t => t.AlertCount, alertCount)
            .Set(t => t.CriticalAlertCount, criticalAlertCount)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task SetLoadingRecordAsync(string taskId, LoadingRecord record)
    {
        var filter = Builders<TransportTask>.Filter.Eq(t => t.Id, taskId);
        var update = Builders<TransportTask>.Update
            .Set(t => t.LoadingRecord, record)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task SetUnloadingRecordAsync(string taskId, LoadingRecord record)
    {
        var filter = Builders<TransportTask>.Filter.Eq(t => t.Id, taskId);
        var update = Builders<TransportTask>.Update
            .Set(t => t.UnloadingRecord, record)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }
}
