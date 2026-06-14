using MongoDB.Driver;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class AuditLogRepository : IAuditLogRepository
{
    private readonly IMongoCollection<AuditLog> _collection;

    public AuditLogRepository(MongoDbContext context)
    {
        _collection = context.AuditLogs;
    }

    public async Task AddAsync(AuditLog log)
    {
        await _collection.InsertOneAsync(log);
    }

    public async Task AddBatchAsync(List<AuditLog> logs)
    {
        if (logs.Count == 0) return;
        await _collection.InsertManyAsync(logs);
    }

    public async Task<CursorPagedResult<AuditLog>> GetPagedAsync(
        AuditActionType? actionType,
        string? module,
        string? operatorId,
        string? operatorName,
        string? entityType,
        string? entityId,
        DateTime? startTime,
        DateTime? endTime,
        bool? status,
        string? cursor,
        int limit,
        bool sortDesc = true)
    {
        var filterBuilder = Builders<AuditLog>.Filter;
        var filters = new List<FilterDefinition<AuditLog>>();

        if (actionType.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.ActionType, actionType.Value));
        }

        if (!string.IsNullOrEmpty(module))
        {
            filters.Add(filterBuilder.Eq(a => a.Module, module));
        }

        if (!string.IsNullOrEmpty(operatorId))
        {
            filters.Add(filterBuilder.Eq(a => a.OperatorId, operatorId));
        }

        if (!string.IsNullOrEmpty(operatorName))
        {
            filters.Add(filterBuilder.Regex(a => a.OperatorName, new MongoDB.Bson.BsonRegularExpression(operatorName, "i")));
        }

        if (!string.IsNullOrEmpty(entityType))
        {
            filters.Add(filterBuilder.Eq(a => a.EntityType, entityType));
        }

        if (!string.IsNullOrEmpty(entityId))
        {
            filters.Add(filterBuilder.Eq(a => a.EntityId, entityId));
        }

        if (startTime.HasValue)
        {
            filters.Add(filterBuilder.Gte(a => a.Timestamp, startTime.Value));
        }

        if (endTime.HasValue)
        {
            filters.Add(filterBuilder.Lte(a => a.Timestamp, endTime.Value));
        }

        if (status.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.Status, status.Value));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sort = sortDesc
            ? Builders<AuditLog>.Sort.Descending(a => a.Timestamp)
            : Builders<AuditLog>.Sort.Ascending(a => a.Timestamp);

        var find = _collection.Find(filter).Sort(sort);

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorTime = DateTime.Parse(cursor);
            find = sortDesc
                ? find.Filter(filterBuilder.Lt(a => a.Timestamp, cursorTime))
                : find.Filter(filterBuilder.Gt(a => a.Timestamp, cursorTime));
        }

        var items = await find.Limit(limit + 1).ToListAsync();
        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Timestamp.ToString("o")
            : null;

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<AuditLog>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }

    public async Task<long> CountAsync(
        AuditActionType? actionType,
        string? module,
        DateTime? startTime,
        DateTime? endTime)
    {
        var filterBuilder = Builders<AuditLog>.Filter;
        var filters = new List<FilterDefinition<AuditLog>>();

        if (actionType.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.ActionType, actionType.Value));
        }

        if (!string.IsNullOrEmpty(module))
        {
            filters.Add(filterBuilder.Eq(a => a.Module, module));
        }

        if (startTime.HasValue)
        {
            filters.Add(filterBuilder.Gte(a => a.Timestamp, startTime.Value));
        }

        if (endTime.HasValue)
        {
            filters.Add(filterBuilder.Lte(a => a.Timestamp, endTime.Value));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        return await _collection.CountDocumentsAsync(filter);
    }
}
