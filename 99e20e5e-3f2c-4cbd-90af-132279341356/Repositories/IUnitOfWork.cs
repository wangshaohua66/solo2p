using FireIoTPlatform.Models.Entities;

namespace FireIoTPlatform.Repositories;

public interface IUnitOfWork : IDisposable
{
    IRepository<FireUnit> FireUnits { get; }
    IRepository<Device> Devices { get; }
    IRepository<DeviceData> DeviceDatas { get; }
    IRepository<AlarmRecord> AlarmRecords { get; }
    IRepository<FireStation> FireStations { get; }
    IRepository<Firefighter> Firefighters { get; }
    IRepository<InspectionTask> InspectionTasks { get; }
    IRepository<InspectionRecord> InspectionRecords { get; }
    IRepository<HazardRecord> HazardRecords { get; }
    IRepository<RescueDispatch> RescueDispatches { get; }
    IRepository<DispatchFirefighter> DispatchFirefighters { get; }
    IRepository<MaintenanceCompany> MaintenanceCompanies { get; }
    IRepository<MaintenanceContract> MaintenanceContracts { get; }
    IRepository<MaintenanceRecord> MaintenanceRecords { get; }
    IRepository<User> Users { get; }
    IRepository<WorkOrder> WorkOrders { get; }

    Task<int> SaveChangesAsync();
    int SaveChanges();
    Task BeginTransactionAsync();
    Task CommitTransactionAsync();
    Task RollbackTransactionAsync();
}
