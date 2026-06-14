using System.Linq.Expressions;
using ColdChainMonitor.Application.DTOs;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(string id);
    Task<List<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(string id, T entity);
    Task DeleteAsync(string id);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
    Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate);
    Task<CursorPagedResult<T>> GetPagedAsync(
        Expression<Func<T, bool>>? predicate,
        string? sortBy,
        bool sortDesc,
        string? cursor,
        int limit);
    Task<long> CountAsync(Expression<Func<T, bool>>? predicate = null);
}
