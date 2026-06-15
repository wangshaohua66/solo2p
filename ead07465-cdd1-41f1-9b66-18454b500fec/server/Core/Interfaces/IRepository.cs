using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;

namespace WaterDispatch.Core.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<T>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task<T> AddAsync(T entity, CancellationToken cancellationToken = default);
    Task UpdateAsync(T entity, CancellationToken cancellationToken = default);
    Task DeleteAsync(T entity, CancellationToken cancellationToken = default);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken cancellationToken = default);
    IQueryable<T> Query();
}

public interface IUnitOfWork : IDisposable
{
    IRepository<Pipe> Pipes { get; }
    IRepository<MonitorNode> MonitorNodes { get; }
    IRepository<PressureReading> PressureReadings { get; }
    IRepository<LeakEvent> LeakEvents { get; }
    IRepository<RepairWorkOrder> RepairWorkOrders { get; }
    IRepository<RepairTeam> RepairTeams { get; }
    IRepository<Valve> Valves { get; }
    IRepository<OutageZone> OutageZones { get; }
    IRepository<InspectionTask> InspectionTasks { get; }
    IRepository<UserAccount> UserAccounts { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
