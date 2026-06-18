using System.Linq.Expressions;
using HazChemSupervision.Data;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Repositories;

public class BaseRepository<T> : IBaseRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public BaseRepository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(int id)
    {
        return await _dbSet.FindAsync(id);
    }

    public virtual async Task<T?> GetByIdAsync(long id)
    {
        return await _dbSet.FindAsync(id);
    }

    public virtual async Task<List<T>> GetAllAsync()
    {
        return await _dbSet.AsNoTracking().ToListAsync();
    }

    public virtual async Task<List<T>> GetListAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.AsNoTracking().Where(predicate).ToListAsync();
    }

    public virtual async Task<List<T>> GetListAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy)
    {
        var query = _dbSet.AsNoTracking().Where(predicate);
        query = orderBy(query);
        return await query.ToListAsync();
    }

    public virtual async Task<PagedResult<T>> GetPagedAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy, int pageIndex, int pageSize)
    {
        var query = _dbSet.AsNoTracking().Where(predicate);
        var totalCount = await query.CountAsync();
        query = orderBy(query);
        var items = await query.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<T>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    public virtual async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public virtual async Task<List<T>> AddRangeAsync(List<T> entities)
    {
        await _dbSet.AddRangeAsync(entities);
        await _context.SaveChangesAsync();
        return entities;
    }

    public virtual async Task UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();
    }

    public virtual async Task UpdateRangeAsync(List<T> entities)
    {
        _dbSet.UpdateRange(entities);
        await _context.SaveChangesAsync();
    }

    public virtual async Task DeleteAsync(T entity)
    {
        _dbSet.Remove(entity);
        await _context.SaveChangesAsync();
    }

    public virtual async Task DeleteRangeAsync(List<T> entities)
    {
        _dbSet.RemoveRange(entities);
        await _context.SaveChangesAsync();
    }

    public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.AnyAsync(predicate);
    }

    public virtual async Task<int> CountAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.CountAsync(predicate);
    }

    public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.AsNoTracking().FirstOrDefaultAsync(predicate);
    }

    public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy)
    {
        var query = _dbSet.AsNoTracking().Where(predicate);
        query = orderBy(query);
        return await query.FirstOrDefaultAsync();
    }

    public virtual IQueryable<T> GetQueryable()
    {
        return _dbSet.AsNoTracking();
    }

    public virtual IQueryable<T> GetQueryable(Expression<Func<T, bool>> predicate)
    {
        return _dbSet.AsNoTracking().Where(predicate);
    }
}
