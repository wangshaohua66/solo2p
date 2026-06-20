using Microsoft.EntityFrameworkCore.Storage;
using FireIoTPlatform.Models.Entities;

namespace FireIoTPlatform.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;

    public IRepository<FireUnit> FireUnits { get; private set; }
    public IRepository<Device> Devices { get; private set; }
    public IRepository<DeviceData> DeviceDatas { get; private set; }
    public IRepository<AlarmRecord> AlarmRecords { get; private set; }
    public IRepository<FireStation> FireStations { get; private set; }
    public IRepository<Firefighter> Firefighters { get; private set; }
    public IRepository<InspectionTask> InspectionTasks { get; private set; }
    public IRepository<InspectionRecord> InspectionRecords { get; private set; }
    public IRepository<HazardRecord> HazardRecords { get; private set; }
    public IRepository<RescueDispatch> RescueDispatches { get; private set; }
    public IRepository<DispatchFirefighter> DispatchFirefighters { get; private set; }
    public IRepository<MaintenanceCompany> MaintenanceCompanies { get; private set; }
    public IRepository<MaintenanceContract> MaintenanceContracts { get; private set; }
    public IRepository<MaintenanceRecord> MaintenanceRecords { get; private set; }
    public IRepository<User> Users { get; private set; }
    public IRepository<WorkOrder> WorkOrders { get; private set; }

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        FireUnits = new Repository<FireUnit>(context);
        Devices = new Repository<Device>(context);
        DeviceDatas = new Repository<DeviceData>(context);
        AlarmRecords = new Repository<AlarmRecord>(context);
        FireStations = new Repository<FireStation>(context);
        Firefighters = new Repository<Firefighter>(context);
        InspectionTasks = new Repository<InspectionTask>(context);
        InspectionRecords = new Repository<InspectionRecord>(context);
        HazardRecords = new Repository<HazardRecord>(context);
        RescueDispatches = new Repository<RescueDispatch>(context);
        DispatchFirefighters = new Repository<DispatchFirefighter>(context);
        MaintenanceCompanies = new Repository<MaintenanceCompany>(context);
        MaintenanceContracts = new Repository<MaintenanceContract>(context);
        MaintenanceRecords = new Repository<MaintenanceRecord>(context);
        Users = new Repository<User>(context);
        WorkOrders = new Repository<WorkOrder>(context);
    }

    public async Task<int> SaveChangesAsync()
    {
        return await _context.SaveChangesAsync();
    }

    public int SaveChanges()
    {
        return _context.SaveChanges();
    }

    public async Task BeginTransactionAsync()
    {
        _transaction = await _context.Database.BeginTransactionAsync();
    }

    public async Task CommitTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync();
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync();
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
