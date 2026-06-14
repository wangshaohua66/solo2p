using System.Linq.Expressions;
using MongoDB.Driver;
using MongoDB.Bson;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public abstract class MongoRepositoryBase<T> : IRepository<T> where T : class
{
    protected readonly IMongoCollection<T> _collection;
    protected readonly MongoDbContext _context;

    protected MongoRepositoryBase(MongoDbContext context, IMongoCollection<T> collection)
    {
        _context = context;
        _collection = collection;
    }

    public virtual async Task<T?> GetByIdAsync(string id)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public virtual async Task<List<T>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public virtual async Task<T> AddAsync(T entity)
    {
        await _collection.InsertOneAsync(entity);
        return entity;
    }

    public virtual async Task UpdateAsync(string id, T entity)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        await _collection.ReplaceOneAsync(filter, entity);
    }

    public virtual async Task DeleteAsync(string id)
    {
        var filter = Builders<T>.Filter.Eq("_id", ObjectId.Parse(id));
        await _collection.DeleteOneAsync(filter);
    }

    public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
    {
        return await _collection.Find(predicate).AnyAsync();
    }

    public virtual async Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate)
    {
        return await _collection.Find(predicate).ToListAsync();
    }

    public virtual async Task<CursorPagedResult<T>> GetPagedAsync(
        Expression<Func<T, bool>>? predicate,
        string? sortBy,
        bool sortDesc,
        string? cursor,
        int limit)
    {
        var filterBuilder = Builders<T>.Filter;
        var filters = new List<FilterDefinition<T>>();

        if (predicate != null)
        {
            filters.Add(predicate);
        }

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorId = ObjectId.Parse(cursor);
            filters.Add(filterBuilder.Lt("_id", cursorId));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sortBuilder = Builders<T>.Sort;
        SortDefinition<T>? sortDefinition = null;
        if (!string.IsNullOrEmpty(sortBy))
        {
            sortDefinition = sortDesc
                ? sortBuilder.Descending(sortBy)
                : sortBuilder.Ascending(sortBy);
        }

        var find = _collection.Find(filter);

        if (sortDefinition != null)
        {
            find = find.Sort(sortDefinition);
        }
        else if (!string.IsNullOrEmpty(cursor))
        {
            find = find.SortByDescending("_id");
        }

        var items = await find.Limit(limit + 1).ToListAsync();

        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = null;
        if (hasMore && resultItems.Count > 0)
        {
            var lastItem = resultItems.Last();
            var idProp = typeof(T).GetProperty("Id");
            if (idProp != null)
            {
                nextCursor = idProp.GetValue(lastItem)?.ToString();
            }
        }

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<T>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }

    public virtual async Task<long> CountAsync(Expression<Func<T, bool>>? predicate = null)
    {
        var filter = predicate ?? Builders<T>.Filter.Empty;
        return await _collection.CountDocumentsAsync(filter);
    }

    protected FilterDefinition<T> BuildIdFilter(string id)
    {
        return Builders<T>.Filter.Eq("Id", ObjectId.Parse(id));
    }
}
