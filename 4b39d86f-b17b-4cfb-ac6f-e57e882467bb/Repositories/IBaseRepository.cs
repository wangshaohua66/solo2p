using System.Linq.Expressions;

namespace HazChemSupervision.Repositories;

public interface IBaseRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<T?> GetByIdAsync(long id);
    Task<List<T>> GetAllAsync();
    Task<List<T>> GetListAsync(Expression<Func<T, bool>> predicate);
    Task<List<T>> GetListAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy);
    Task<PagedResult<T>> GetPagedAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy, int pageIndex, int pageSize);
    Task<T> AddAsync(T entity);
    Task<List<T>> AddRangeAsync(List<T> entities);
    Task UpdateAsync(T entity);
    Task UpdateRangeAsync(List<T> entities);
    Task DeleteAsync(T entity);
    Task DeleteRangeAsync(List<T> entities);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
    Task<int> CountAsync(Expression<Func<T, bool>> predicate);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, Func<IQueryable<T>, IOrderedQueryable<T>> orderBy);
    IQueryable<T> GetQueryable();
    IQueryable<T> GetQueryable(Expression<Func<T, bool>> predicate);
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new List<T>();
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
