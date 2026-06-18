using HazChemSupervision.Models;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Enterprise> Enterprises { get; set; }
    public DbSet<Chemical> Chemicals { get; set; }
    public DbSet<Warehouse> Warehouses { get; set; }
    public DbSet<ChemicalBatch> ChemicalBatches { get; set; }
    public DbSet<TransportRecord> TransportRecords { get; set; }
    public DbSet<TransportTrajectory> TransportTrajectories { get; set; }
    public DbSet<Inventory> Inventories { get; set; }
    public DbSet<InventoryTransaction> InventoryTransactions { get; set; }
    public DbSet<ProcessRecord> ProcessRecords { get; set; }
    public DbSet<Certificate> Certificates { get; set; }
    public DbSet<HazardRectification> HazardRectifications { get; set; }
    public DbSet<EmergencyDrill> EmergencyDrills { get; set; }
    public DbSet<Alert> Alerts { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Enterprise>(entity =>
        {
            entity.HasIndex(e => e.UnifiedSocialCreditCode).IsUnique();
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.IsActive);
        });

        modelBuilder.Entity<Chemical>(entity =>
        {
            entity.HasIndex(c => c.Code).IsUnique();
            entity.HasIndex(c => c.CasNo);
            entity.HasIndex(c => c.Category);
            entity.HasIndex(c => c.EnterpriseId);
            entity.HasIndex(c => new { c.EnterpriseId, c.Name });
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasIndex(w => w.Code).IsUnique();
            entity.HasIndex(w => w.EnterpriseId);
            entity.HasIndex(w => w.Type);
        });

        modelBuilder.Entity<ChemicalBatch>(entity =>
        {
            entity.HasIndex(b => b.BatchNo).IsUnique();
            entity.HasIndex(b => b.ChemicalId);
            entity.HasIndex(b => b.EnterpriseId);
            entity.HasIndex(b => b.WarehouseId);
            entity.HasIndex(b => b.Status);
            entity.HasIndex(b => b.ProductionDate);
            entity.HasIndex(b => b.ExpiryDate);
            entity.HasIndex(b => new { b.EnterpriseId, b.Status, b.ExpiryDate });
        });

        modelBuilder.Entity<TransportRecord>(entity =>
        {
            entity.HasIndex(t => t.TransportNo).IsUnique();
            entity.HasIndex(t => t.EnterpriseId);
            entity.HasIndex(t => t.ChemicalBatchId);
            entity.HasIndex(t => t.VehiclePlateNo);
            entity.HasIndex(t => t.Status);
            entity.HasIndex(t => t.PlannedDepartureTime);
            entity.HasIndex(t => t.GpsDeviceId);
            entity.HasIndex(t => new { t.Status, t.IsDeviating, t.IsOverspeeding });
        });

        modelBuilder.Entity<TransportTrajectory>(entity =>
        {
            entity.HasIndex(t => t.TransportRecordId);
            entity.HasIndex(t => t.GpsDeviceId);
            entity.HasIndex(t => t.RecordTime);
            entity.HasIndex(t => new { t.TransportRecordId, t.RecordTime });
            entity.HasIndex(t => new { t.GpsDeviceId, t.RecordTime });
        });

        modelBuilder.Entity<Inventory>(entity =>
        {
            entity.HasIndex(i => i.EnterpriseId);
            entity.HasIndex(i => i.WarehouseId);
            entity.HasIndex(i => i.ChemicalId);
            entity.HasIndex(i => i.Status);
            entity.HasIndex(i => new { i.EnterpriseId, i.WarehouseId, i.ChemicalId }).IsUnique();
            entity.HasIndex(i => new { i.EnterpriseId, i.Status, i.HasOverstockAlert });
        });

        modelBuilder.Entity<InventoryTransaction>(entity =>
        {
            entity.HasIndex(t => t.InventoryId);
            entity.HasIndex(t => t.ChemicalBatchId);
            entity.HasIndex(t => t.EnterpriseId);
            entity.HasIndex(t => t.TransactionType);
            entity.HasIndex(t => t.TransactionTime);
            entity.HasIndex(t => t.IdempotencyKey).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
            entity.HasIndex(t => new { t.EnterpriseId, t.TransactionTime });
        });

        modelBuilder.Entity<ProcessRecord>(entity =>
        {
            entity.HasIndex(p => p.ChemicalBatchId);
            entity.HasIndex(p => p.Stage);
            entity.HasIndex(p => p.Status);
            entity.HasIndex(p => p.OperatorId);
            entity.HasIndex(p => new { p.ChemicalBatchId, p.Stage }).IsUnique();
        });

        modelBuilder.Entity<Certificate>(entity =>
        {
            entity.HasIndex(c => c.CertificateNo).IsUnique();
            entity.HasIndex(c => c.Type);
            entity.HasIndex(c => c.EnterpriseId);
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => c.Status);
            entity.HasIndex(c => c.ExpiryDate);
            entity.HasIndex(c => new { c.Status, c.ExpiryDate });
        });

        modelBuilder.Entity<HazardRectification>(entity =>
        {
            entity.HasIndex(h => h.WorkOrderNo).IsUnique();
            entity.HasIndex(h => h.EnterpriseId);
            entity.HasIndex(h => h.Source);
            entity.HasIndex(h => h.Level);
            entity.HasIndex(h => h.Status);
            entity.HasIndex(h => h.Deadline);
            entity.HasIndex(h => new { h.EnterpriseId, h.Status, h.Deadline });
            entity.HasIndex(h => new { h.IsEscalated, h.Status });
        });

        modelBuilder.Entity<EmergencyDrill>(entity =>
        {
            entity.HasIndex(d => d.PlanNo).IsUnique();
            entity.HasIndex(d => d.EnterpriseId);
            entity.HasIndex(d => d.Type);
            entity.HasIndex(d => d.Status);
            entity.HasIndex(d => d.Year);
            entity.HasIndex(d => d.Quarter);
            entity.HasIndex(d => d.PlannedStartTime);
            entity.HasIndex(d => new { d.Year, d.Quarter, d.EnterpriseId, d.Status });
        });

        modelBuilder.Entity<Alert>(entity =>
        {
            entity.HasIndex(a => a.AlertNo).IsUnique();
            entity.HasIndex(a => a.Type);
            entity.HasIndex(a => a.Level);
            entity.HasIndex(a => a.Status);
            entity.HasIndex(a => a.EnterpriseId);
            entity.HasIndex(a => a.CreatedAt);
            entity.HasIndex(a => new { a.Status, a.Level, a.CreatedAt });
            entity.HasIndex(a => new { a.RecipientUserId, a.IsRead, a.CreatedAt });
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Role);
            entity.HasIndex(u => u.EnterpriseId);
            entity.HasIndex(u => u.IsActive);
        });
    }
}
