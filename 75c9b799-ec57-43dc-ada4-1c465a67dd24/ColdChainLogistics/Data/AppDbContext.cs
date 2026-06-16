using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Models.Entities;

namespace ColdChainLogistics.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Customer> Customers { get; set; }
    public DbSet<NotificationPreference> NotificationPreferences { get; set; }
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<Sensor> Sensors { get; set; }
    public DbSet<DeviceMaintenanceWindow> DeviceMaintenanceWindows { get; set; }
    public DbSet<Warehouse> Warehouses { get; set; }
    public DbSet<WarehouseEnvRecord> WarehouseEnvRecords { get; set; }
    public DbSet<Shipment> Shipments { get; set; }
    public DbSet<ShipmentBatch> ShipmentBatches { get; set; }
    public DbSet<SensorData> SensorData { get; set; }
    public DbSet<AlertRule> AlertRules { get; set; }
    public DbSet<AlertRuleCondition> AlertRuleConditions { get; set; }
    public DbSet<AlertRuleAuditLog> AlertRuleAuditLogs { get; set; }
    public DbSet<Alert> Alerts { get; set; }
    public DbSet<NotificationRecord> NotificationRecords { get; set; }
    public DbSet<TraceabilityRecord> TraceabilityRecords { get; set; }
    public DbSet<ReportRecord> ReportRecords { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Customer>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.CustomerCode).IsUnique();
            b.Property(e => e.CustomerCode).HasMaxLength(50).IsRequired();
            b.Property(e => e.Name).HasMaxLength(200).IsRequired();
            b.Property(e => e.ContactPerson).HasMaxLength(50);
            b.Property(e => e.ContactPhone).HasMaxLength(20);
            b.Property(e => e.ContactEmail).HasMaxLength(100);
            b.Property(e => e.Address).HasMaxLength(500);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<NotificationPreference>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.CustomerId, e.Severity, e.Channel });
            b.Property(e => e.Recipient).HasMaxLength(200);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Vehicle>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.VehicleNumber).IsUnique();
            b.HasIndex(e => e.PlateNumber).IsUnique();
            b.Property(e => e.VehicleNumber).HasMaxLength(50).IsRequired();
            b.Property(e => e.PlateNumber).HasMaxLength(20);
            b.Property(e => e.Model).HasMaxLength(100);
            b.Property(e => e.RouteCode).HasMaxLength(50);
            b.Property(e => e.CurrentLocation).HasMaxLength(200);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Sensor>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.SensorCode).IsUnique();
            b.HasIndex(e => e.DeviceId).IsUnique();
            b.Property(e => e.SensorCode).HasMaxLength(50).IsRequired();
            b.Property(e => e.DeviceId).HasMaxLength(100).IsRequired();
            b.Property(e => e.LocationDescription).HasMaxLength(200);
            b.HasOne(e => e.Vehicle)
             .WithMany(e => e.Sensors)
             .HasForeignKey(e => e.VehicleId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Warehouse)
             .WithMany(e => e.Sensors)
             .HasForeignKey(e => e.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<DeviceMaintenanceWindow>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.SensorId, e.StartTime });
            b.Property(e => e.Reason).HasMaxLength(500);
            b.Property(e => e.CreatedBy).HasMaxLength(50);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Warehouse>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.WarehouseCode).IsUnique();
            b.Property(e => e.WarehouseCode).HasMaxLength(50).IsRequired();
            b.Property(e => e.Name).HasMaxLength(200).IsRequired();
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.TemperatureZone).HasMaxLength(50);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<WarehouseEnvRecord>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.WarehouseId, e.RecordTime });
            b.HasIndex(e => new { e.SensorId, e.RecordTime });
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Shipment>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.ShipmentNumber).IsUnique();
            b.HasIndex(e => new { e.CustomerId, e.CreatedAt });
            b.HasIndex(e => new { e.VehicleId, e.Status });
            b.Property(e => e.ShipmentNumber).HasMaxLength(50).IsRequired();
            b.Property(e => e.Destination).HasMaxLength(500);
            b.Property(e => e.RouteCode).HasMaxLength(50);
            b.Property(e => e.DriverName).HasMaxLength(50);
            b.Property(e => e.DriverPhone).HasMaxLength(20);
            b.Property(e => e.Remarks).HasMaxLength(1000);
            b.HasOne(e => e.Customer)
             .WithMany(e => e.Shipments)
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Vehicle)
             .WithMany(e => e.Shipments)
             .HasForeignKey(e => e.VehicleId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.OriginWarehouse)
             .WithMany()
             .HasForeignKey(e => e.OriginWarehouseId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<ShipmentBatch>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.BatchNumber);
            b.HasIndex(e => new { e.ShipmentId, e.BatchNumber });
            b.Property(e => e.BatchNumber).HasMaxLength(100).IsRequired();
            b.Property(e => e.ProductName).HasMaxLength(200).IsRequired();
            b.Property(e => e.ProductCategory).HasMaxLength(100);
            b.Property(e => e.Unit).HasMaxLength(20);
            b.Property(e => e.StorageCondition).HasMaxLength(200);
            b.HasOne(e => e.Shipment)
             .WithMany(e => e.Batches)
             .HasForeignKey(e => e.ShipmentId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(e => e.Warehouse)
             .WithMany(e => e.InventoryBatches)
             .HasForeignKey(e => e.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<SensorData>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.SensorId, e.Timestamp });
            b.HasIndex(e => new { e.VehicleId, e.Timestamp });
            b.HasIndex(e => new { e.ShipmentId, e.Timestamp });
            b.Property(e => e.RawPayload).HasColumnType("json");
            b.Property(e => e.ValidationErrors).HasMaxLength(1000);
            b.HasOne(e => e.Sensor)
             .WithMany()
             .HasForeignKey(e => e.SensorId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Vehicle)
             .WithMany()
             .HasForeignKey(e => e.VehicleId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Shipment)
             .WithMany(e => e.SensorData)
             .HasForeignKey(e => e.ShipmentId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AlertRule>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.CustomerId, e.IsEnabled });
            b.Property(e => e.RuleName).HasMaxLength(200).IsRequired();
            b.Property(e => e.Description).HasMaxLength(1000);
            b.Property(e => e.ApplicableSensorTypes).HasMaxLength(200);
            b.Property(e => e.ApplicableRoutes).HasMaxLength(500);
            b.Property(e => e.CreatedBy).HasMaxLength(50);
            b.Property(e => e.UpdatedBy).HasMaxLength(50);
            b.HasOne(e => e.Customer)
             .WithMany(e => e.AlertRules)
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<AlertRuleCondition>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.AlertRuleId);
            b.Property(e => e.Metric).HasMaxLength(50).IsRequired();
            b.Property(e => e.Unit).HasMaxLength(20);
            b.HasOne(e => e.AlertRule)
             .WithMany(e => e.Conditions)
             .HasForeignKey(e => e.AlertRuleId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<AlertRuleAuditLog>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.AlertRuleId, e.CreatedAt });
            b.Property(e => e.Action).HasMaxLength(50).IsRequired();
            b.Property(e => e.Operator).HasMaxLength(50).IsRequired();
            b.Property(e => e.IpAddress).HasMaxLength(50);
            b.Property(e => e.OldValue).HasColumnType("json");
            b.Property(e => e.NewValue).HasColumnType("json");
            b.HasOne(e => e.AlertRule)
             .WithMany(e => e.AuditLogs)
             .HasForeignKey(e => e.AlertRuleId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Alert>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.AlertCode).IsUnique();
            b.HasIndex(e => new { e.CustomerId, e.Status, e.CreatedAt });
            b.HasIndex(e => new { e.VehicleId, e.Status });
            b.HasIndex(e => new { e.ShipmentId, e.Severity });
            b.Property(e => e.AlertCode).HasMaxLength(50).IsRequired();
            b.Property(e => e.Title).HasMaxLength(200).IsRequired();
            b.Property(e => e.Description).HasMaxLength(1000);
            b.Property(e => e.TriggerMetric).HasMaxLength(50);
            b.Property(e => e.AcknowledgedBy).HasMaxLength(50);
            b.Property(e => e.ResolvedBy).HasMaxLength(50);
            b.Property(e => e.ResolutionNotes).HasMaxLength(2000);
            b.HasOne(e => e.AlertRule)
             .WithMany()
             .HasForeignKey(e => e.AlertRuleId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Customer)
             .WithMany()
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Vehicle)
             .WithMany()
             .HasForeignKey(e => e.VehicleId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Sensor)
             .WithMany()
             .HasForeignKey(e => e.SensorId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Shipment)
             .WithMany(e => e.Alerts)
             .HasForeignKey(e => e.ShipmentId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<NotificationRecord>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.AlertId, e.Channel });
            b.HasIndex(e => new { e.CustomerId, e.CreatedAt });
            b.Property(e => e.Recipient).HasMaxLength(200).IsRequired();
            b.Property(e => e.Subject).HasMaxLength(200).IsRequired();
            b.Property(e => e.Content).HasMaxLength(5000);
            b.Property(e => e.ErrorMessage).HasMaxLength(1000);
            b.HasOne(e => e.Alert)
             .WithMany(e => e.Notifications)
             .HasForeignKey(e => e.AlertId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(e => e.Customer)
             .WithMany()
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<TraceabilityRecord>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.TraceId).IsUnique();
            b.HasIndex(e => new { e.ShipmentId, e.Sequence });
            b.HasIndex(e => new { e.BatchNumber, e.Timestamp });
            b.Property(e => e.TraceId).HasMaxLength(64).IsRequired();
            b.Property(e => e.BatchNumber).HasMaxLength(100).IsRequired();
            b.Property(e => e.NodeType).HasMaxLength(50).IsRequired();
            b.Property(e => e.NodeName).HasMaxLength(200).IsRequired();
            b.Property(e => e.Location).HasMaxLength(500);
            b.Property(e => e.OperatorName).HasMaxLength(50);
            b.Property(e => e.Remark).HasMaxLength(1000);
            b.Property(e => e.DataHash).HasMaxLength(64);
            b.Property(e => e.PreviousHash).HasMaxLength(64);
            b.HasOne(e => e.Shipment)
             .WithMany(e => e.TraceabilityRecords)
             .HasForeignKey(e => e.ShipmentId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(e => e.Batch)
             .WithMany(e => e.TraceabilityRecords)
             .HasForeignKey(e => e.BatchId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<ReportRecord>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.ReportNumber).IsUnique();
            b.HasIndex(e => new { e.CustomerId, e.ReportPeriodStart, e.ReportPeriodEnd });
            b.Property(e => e.ReportNumber).HasMaxLength(50).IsRequired();
            b.Property(e => e.ReportType).HasMaxLength(50).IsRequired();
            b.Property(e => e.FilePath).HasMaxLength(500);
            b.Property(e => e.FileName).HasMaxLength(200);
            b.Property(e => e.GeneratedBy).HasMaxLength(50);
            b.Property(e => e.Status).HasMaxLength(20);
            b.Property(e => e.ErrorMessage).HasMaxLength(2000);
            b.HasOne(e => e.Customer)
             .WithMany()
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(e => e.Shipment)
             .WithMany()
             .HasForeignKey(e => e.ShipmentId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Username).IsUnique();
            b.Property(e => e.Username).HasMaxLength(50).IsRequired();
            b.Property(e => e.PasswordHash).HasMaxLength(200).IsRequired();
            b.Property(e => e.FullName).HasMaxLength(50);
            b.Property(e => e.Email).HasMaxLength(100);
            b.Property(e => e.Phone).HasMaxLength(20);
            b.Property(e => e.LastLoginIp).HasMaxLength(50);
            b.HasOne(e => e.Customer)
             .WithMany()
             .HasForeignKey(e => e.CustomerId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(e => !e.IsDeleted);
        });
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
        var entries = ChangeTracker.Entries<BaseEntity>();
        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }
}
