using System.Linq.Expressions;
using BloodCenter.Core.Interfaces.Data;
using Microsoft.EntityFrameworkCore;

namespace BloodCenter.Infrastructure.Data.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly BloodCenterDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(BloodCenterDbContext context)
    {
        _context = context;
        _dbSet = _context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FirstOrDefaultAsync(e => EF.Property<Guid>(e, "Id") == id && !EF.Property<bool>(e, "IsDeleted"), cancellationToken);
    }

    public virtual async Task<T?> GetByIdAsync(Guid id, string[] includes, CancellationToken cancellationToken = default)
    {
        var query = ApplyIncludes(_dbSet.AsQueryable(), includes);
        return await query.FirstOrDefaultAsync(e => EF.Property<Guid>(e, "Id") == id && !EF.Property<bool>(e, "IsDeleted"), cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet.ToListAsync(cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> GetAllAsync(string[] includes, CancellationToken cancellationToken = default)
    {
        var query = ApplyIncludes(_dbSet.AsQueryable(), includes);
        return await query.ToListAsync(cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.Where(predicate).ToListAsync(cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, string[] includes, CancellationToken cancellationToken = default)
    {
        var query = ApplyIncludes(_dbSet.Where(predicate), includes);
        return await query.ToListAsync(cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> FindAsync(
        Expression<Func<T, bool>> predicate,
        Expression<Func<T, object>> orderBy,
        bool orderDescending = true,
        string[]? includes = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet.Where(predicate);

        var ordered = orderDescending
            ? query.OrderByDescending(orderBy)
            : query.OrderBy(orderBy);

        query = ApplyIncludes(ordered, includes);

        return await query.ToListAsync(cancellationToken);
    }

    public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FirstOrDefaultAsync(predicate, cancellationToken);
    }

    public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, string[] includes, CancellationToken cancellationToken = default)
    {
        var query = ApplyIncludes(_dbSet.Where(predicate), includes);
        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.AnyAsync(predicate, cancellationToken);
    }

    public virtual async Task AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        await _dbSet.AddAsync(entity, cancellationToken);
    }

    public virtual async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
    {
        await _dbSet.AddRangeAsync(entities, cancellationToken);
    }

    public virtual void Update(T entity)
    {
        _dbSet.Update(entity);
    }

    public virtual void UpdateRange(IEnumerable<T> entities)
    {
        _dbSet.UpdateRange(entities);
    }

    public virtual void Delete(T entity)
    {
        _dbSet.Remove(entity);
    }

    public virtual void DeleteRange(IEnumerable<T> entities)
    {
        _dbSet.RemoveRange(entities);
    }

    public virtual async Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.CountAsync(predicate, cancellationToken);
    }

    public virtual async Task<(IEnumerable<T> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        Expression<Func<T, bool>>? predicate = null,
        Expression<Func<T, object>>? orderBy = null,
        bool orderDescending = true,
        Expression<Func<T, object>>? thenBy = null,
        bool thenByDescending = true,
        string[]? includes = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsQueryable();

        if (predicate != null)
        {
            query = query.Where(predicate);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        if (orderBy != null)
        {
            var ordered = orderDescending
                ? query.OrderByDescending(orderBy)
                : query.OrderBy(orderBy);

            if (thenBy != null)
            {
                ordered = thenByDescending
                    ? ordered.ThenByDescending(thenBy)
                    : ordered.ThenBy(thenBy);
            }

            query = ordered;
        }

        query = ApplyIncludes(query, includes);

        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    protected static IQueryable<T> ApplyIncludes(IQueryable<T> query, string[]? includes)
    {
        if (includes == null || includes.Length == 0)
        {
            return query;
        }

        foreach (var include in includes)
        {
            query = query.Include(include);
        }

        return query;
    }
}
