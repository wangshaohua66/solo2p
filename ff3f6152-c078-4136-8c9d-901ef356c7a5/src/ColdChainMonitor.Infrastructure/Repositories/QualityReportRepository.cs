using MongoDB.Driver;
using MongoDB.Bson;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class QualityReportRepository : MongoRepositoryBase<QualityReport>, IQualityReportRepository
{
    public QualityReportRepository(MongoDbContext context)
        : base(context, context.QualityReports)
    {
    }

    public async Task<QualityReport?> GetByReportNoAsync(string reportNo)
    {
        var filter = Builders<QualityReport>.Filter.Eq(r => r.ReportNo, reportNo);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<QualityReport?> GetByTransportTaskIdAsync(string transportTaskId)
    {
        var filter = Builders<QualityReport>.Filter.Eq(r => r.TransportTaskId, transportTaskId);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<CursorPagedResult<QualityReport>> GetPagedAsync(
        QualityResult? result,
        string? keyword,
        string? taskNo,
        string? inspectorId,
        DateTime? startTime,
        DateTime? endTime,
        string? cursor,
        int limit,
        bool sortDesc = true)
    {
        var filterBuilder = Builders<QualityReport>.Filter;
        var filters = new List<FilterDefinition<QualityReport>>();

        if (result.HasValue)
        {
            filters.Add(filterBuilder.Eq(r => r.Result, result.Value));
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            filters.Add(filterBuilder.Or(
                filterBuilder.Regex(r => r.ReportNo, new BsonRegularExpression(keyword, "i")),
                filterBuilder.Regex(r => r.TaskNo, new BsonRegularExpression(keyword, "i")),
                filterBuilder.Regex(r => r.DrugBatch.DrugName, new BsonRegularExpression(keyword, "i"))
            ));
        }

        if (!string.IsNullOrEmpty(taskNo))
        {
            filters.Add(filterBuilder.Eq(r => r.TaskNo, taskNo));
        }

        if (!string.IsNullOrEmpty(inspectorId))
        {
            filters.Add(filterBuilder.Eq(r => r.InspectorId, inspectorId));
        }

        if (startTime.HasValue)
        {
            filters.Add(filterBuilder.Gte(r => r.CreatedAt, startTime.Value));
        }

        if (endTime.HasValue)
        {
            filters.Add(filterBuilder.Lte(r => r.CreatedAt, endTime.Value));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sort = sortDesc
            ? Builders<QualityReport>.Sort.Descending(r => r.CreatedAt)
            : Builders<QualityReport>.Sort.Ascending(r => r.CreatedAt);

        var find = _collection.Find(filter).Sort(sort);

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorId = ObjectId.Parse(cursor);
            find = sortDesc
                ? find.Filter(filterBuilder.Lt(r => r.Id, cursorId.ToString()))
                : find.Filter(filterBuilder.Gt(r => r.Id, cursorId.ToString()));
        }

        var items = await find.Limit(limit + 1).ToListAsync();
        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Id
            : null;

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<QualityReport>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }
}
