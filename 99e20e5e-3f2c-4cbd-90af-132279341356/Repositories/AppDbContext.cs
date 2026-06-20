using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.Entities;

namespace FireIoTPlatform.Repositories;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<FireUnit> FireUnits { get; set; }
    public DbSet<Device> Devices { get; set; }
    public DbSet<DeviceData> DeviceDatas { get; set; }
    public DbSet<AlarmRecord> AlarmRecords { get; set; }
    public DbSet<FireStation> FireStations { get; set; }
    public DbSet<Firefighter> Firefighters { get; set; }
    public DbSet<InspectionTask> InspectionTasks { get; set; }
    public DbSet<InspectionRecord> InspectionRecords { get; set; }
    public DbSet<HazardRecord> HazardRecords { get; set; }
    public DbSet<RescueDispatch> RescueDispatches { get; set; }
    public DbSet<DispatchFirefighter> DispatchFirefighters { get; set; }
    public DbSet<MaintenanceCompany> MaintenanceCompanies { get; set; }
    public DbSet<MaintenanceContract> MaintenanceContracts { get; set; }
    public DbSet<MaintenanceRecord> MaintenanceRecords { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<WorkOrder> WorkOrders { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DeviceData>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.DeviceId, e.Timestamp });
            entity.HasIndex(e => new { e.FireUnitId, e.Timestamp });
            entity.HasIndex(e => new { e.Year, e.Month, e.DeviceId });
        });

        modelBuilder.Entity<AlarmRecord>(entity =>
        {
            entity.HasIndex(e => e.AlarmNo).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.DeviceId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.AlarmTime);
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.HasIndex(e => e.DeviceCode).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<FireUnit>(entity =>
        {
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.DistrictCode);
            entity.HasIndex(e => e.IsKeyUnit);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.UserName).IsUnique();
            entity.HasIndex(e => e.Role);
        });

        modelBuilder.Entity<InspectionTask>(entity =>
        {
            entity.HasIndex(e => e.TaskNo).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.PlanStartDate);
        });

        modelBuilder.Entity<HazardRecord>(entity =>
        {
            entity.HasIndex(e => e.HazardNo).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.Deadline);
        });

        modelBuilder.Entity<RescueDispatch>(entity =>
        {
            entity.HasIndex(e => e.DispatchNo).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.FireStationId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.DispatchTime);
        });

        modelBuilder.Entity<MaintenanceContract>(entity =>
        {
            entity.HasIndex(e => e.ContractNo).IsUnique();
            entity.HasIndex(e => e.FireUnitId);
            entity.HasIndex(e => e.MaintenanceCompanyId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.EndDate);
        });

        modelBuilder.Entity<DispatchFirefighter>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.DispatchId);
            entity.HasIndex(e => e.FirefighterId);
            entity.HasIndex(e => new { e.DispatchId, e.FirefighterId }).IsUnique();
        });

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(string))
                {
                    var maxLengthAttribute = property.PropertyInfo?.GetCustomAttributes(
                        typeof(System.ComponentModel.DataAnnotations.MaxLengthAttribute), false)
                        .FirstOrDefault() as System.ComponentModel.DataAnnotations.MaxLengthAttribute;
                    if (maxLengthAttribute == null && property.GetMaxLength() == null)
                    {
                        property.SetMaxLength(500);
                    }
                }
            }
        }
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries();
        foreach (var entry in entries)
        {
            if (entry.Entity is BaseEntity entity)
            {
                switch (entry.State)
                {
                    case EntityState.Added:
                        entity.CreatedAt = DateTime.Now;
                        entity.IsDeleted = false;
                        break;
                    case EntityState.Modified:
                        entity.UpdatedAt = DateTime.Now;
                        break;
                }
            }
        }
    }
}
