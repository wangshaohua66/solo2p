using System.Linq.Expressions;
using FireIoTPlatform.Models.DTOs.Common;

namespace FireIoTPlatform.Repositories;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(long id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
    Task<PagedResult<T>> GetPagedAsync(
        Expression<Func<T, bool>>? predicate = null,
        int pageIndex = 1,
        int pageSize = 20,
        Expression<Func<T, object>>? orderBy = null,
        bool isDescending = true);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
    Task AddAsync(T entity);
    Task AddRangeAsync(IEnumerable<T> entities);
    void Update(T entity);
    void UpdateRange(IEnumerable<T> entities);
    void Delete(T entity);
    void DeleteRange(IEnumerable<T> entities);
}
