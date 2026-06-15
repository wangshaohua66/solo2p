using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Interfaces;

namespace WaterDispatch.Infrastructure.Data;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FindAsync(new object[] { id }, cancellationToken);
    }

    public async Task<List<T>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet.ToListAsync(cancellationToken);
    }

    public async Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.Where(predicate).ToListAsync(cancellationToken);
    }

    public async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        var result = await _dbSet.AddAsync(entity, cancellationToken);
        return result.Entity;
    }

    public Task UpdateAsync(T entity, CancellationToken cancellationToken = default)
    {
        _dbSet.Update(entity);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(T entity, CancellationToken cancellationToken = default)
    {
        _dbSet.Remove(entity);
        return Task.CompletedTask;
    }

    public async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken cancellationToken = default)
    {
        return predicate == null
            ? await _dbSet.CountAsync(cancellationToken)
            : await _dbSet.Where(predicate).CountAsync(cancellationToken);
    }

    public IQueryable<T> Query()
    {
        return _dbSet.AsQueryable();
    }
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IRepository<Pipe>? _pipes;
    private IRepository<MonitorNode>? _monitorNodes;
    private IRepository<PressureReading>? _pressureReadings;
    private IRepository<LeakEvent>? _leakEvents;
    private IRepository<RepairWorkOrder>? _repairWorkOrders;
    private IRepository<RepairTeam>? _repairTeams;
    private IRepository<Valve>? _valves;
    private IRepository<OutageZone>? _outageZones;
    private IRepository<InspectionTask>? _inspectionTasks;
    private IRepository<UserAccount>? _userAccounts;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    public IRepository<Pipe> Pipes => _pipes ??= new Repository<Pipe>(_context);
    public IRepository<MonitorNode> MonitorNodes => _monitorNodes ??= new Repository<MonitorNode>(_context);
    public IRepository<PressureReading> PressureReadings => _pressureReadings ??= new Repository<PressureReading>(_context);
    public IRepository<LeakEvent> LeakEvents => _leakEvents ??= new Repository<LeakEvent>(_context);
    public IRepository<RepairWorkOrder> RepairWorkOrders => _repairWorkOrders ??= new Repository<RepairWorkOrder>(_context);
    public IRepository<RepairTeam> RepairTeams => _repairTeams ??= new Repository<RepairTeam>(_context);
    public IRepository<Valve> Valves => _valves ??= new Repository<Valve>(_context);
    public IRepository<OutageZone> OutageZones => _outageZones ??= new Repository<OutageZone>(_context);
    public IRepository<InspectionTask> InspectionTasks => _inspectionTasks ??= new Repository<InspectionTask>(_context);
    public IRepository<UserAccount> UserAccounts => _userAccounts ??= new Repository<UserAccount>(_context);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }

    public void Dispose()
    {
        _context.Dispose();
        GC.SuppressFinalize(this);
    }
}
