using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Entities;

namespace WaterDispatch.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Pipe> Pipes => Set<Pipe>();
    public DbSet<MonitorNode> MonitorNodes => Set<MonitorNode>();
    public DbSet<PressureReading> PressureReadings => Set<PressureReading>();
    public DbSet<LeakEvent> LeakEvents => Set<LeakEvent>();
    public DbSet<RepairWorkOrder> RepairWorkOrders => Set<RepairWorkOrder>();
    public DbSet<RepairTeam> RepairTeams => Set<RepairTeam>();
    public DbSet<Valve> Valves => Set<Valve>();
    public DbSet<OutageZone> OutageZones => Set<OutageZone>();
    public DbSet<InspectionTask> InspectionTasks => Set<InspectionTask>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<WorkOrderStatusLog> WorkOrderStatusLogs => Set<WorkOrderStatusLog>();
    public DbSet<ValveOperation> ValveOperations => Set<ValveOperation>();
    public DbSet<InspectionReport> InspectionReports => Set<InspectionReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Pipe>(b =>
        {
            b.HasKey(p => p.Id);
            b.HasIndex(p => p.Code).IsUnique();
            b.Property(p => p.Geometry)
                .HasColumnType("json");
        });

        modelBuilder.Entity<MonitorNode>(b =>
        {
            b.HasKey(m => m.Id);
            b.HasIndex(m => m.Code).IsUnique();
            b.Property(m => m.CurrentPressure).HasColumnType("decimal(18,4)");
            b.Property(m => m.CurrentFlow).HasColumnType("decimal(18,4)");
        });

        modelBuilder.Entity<PressureReading>(b =>
        {
            b.HasKey(p => p.Id);
            b.HasIndex(p => new { p.NodeId, p.ReadingTime, p.PartitionKey });
            b.HasOne(p => p.Node)
                .WithMany(m => m.PressureReadings)
                .HasForeignKey(p => p.NodeId);
            b.Property(p => p.Pressure).HasColumnType("decimal(18,4)");
            b.Property(p => p.Flow).HasColumnType("decimal(18,4)");
        });

        modelBuilder.Entity<LeakEvent>(b =>
        {
            b.HasKey(l => l.Id);
            b.HasIndex(l => l.EventNo).IsUnique();
            b.Property(l => l.AbnormalNodeIds)
                .HasColumnType("json");
            b.Property(l => l.CandidatePoints)
                .HasColumnType("json");
        });

        modelBuilder.Entity<RepairWorkOrder>(b =>
        {
            b.HasKey(w => w.Id);
            b.HasIndex(w => w.OrderNo).IsUnique();
            b.HasOne(w => w.AssignedTeam)
                .WithMany(t => t.WorkOrders)
                .HasForeignKey(w => w.AssignedTeamId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasMany(w => w.StatusLogs)
                .WithOne()
                .HasForeignKey(s => s.WorkOrderId);
            b.HasMany(w => w.ValveOperations)
                .WithOne()
                .HasForeignKey(v => v.WorkOrderId);
            b.HasOne(w => w.OutageZone)
                .WithOne()
                .HasForeignKey<OutageZone>(o => o.WorkOrderId);
        });

        modelBuilder.Entity<RepairTeam>(b =>
        {
            b.HasKey(t => t.Id);
            b.HasIndex(t => t.TeamCode).IsUnique();
            b.Property(t => t.Vehicles).HasColumnType("json");
            b.Property(t => t.Equipment).HasColumnType("json");
        });

        modelBuilder.Entity<Valve>(b =>
        {
            b.HasKey(v => v.Id);
            b.HasIndex(v => v.Code).IsUnique();
            b.Property(v => v.AffectedPipeIds).HasColumnType("json");
        });

        modelBuilder.Entity<OutageZone>(b =>
        {
            b.HasKey(o => o.Id);
            b.Property(o => o.Polygon).HasColumnType("json");
            b.Property(o => o.AffectedPipeIds).HasColumnType("json");
            b.Property(o => o.AffectedValveIds).HasColumnType("json");
        });

        modelBuilder.Entity<InspectionTask>(b =>
        {
            b.HasKey(i => i.Id);
            b.HasIndex(i => i.TaskNo).IsUnique();
            b.Property(i => i.TargetPipeIds).HasColumnType("json");
            b.Property(i => i.RoutePoints).HasColumnType("json");
            b.HasMany(i => i.Reports)
                .WithOne()
                .HasForeignKey(r => r.TaskId);
        });

        modelBuilder.Entity<InspectionReport>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.PhotoUrls).HasColumnType("json");
        });

        modelBuilder.Entity<UserAccount>(b =>
        {
            b.HasKey(u => u.Id);
            b.HasIndex(u => u.Username).IsUnique();
        });
    }
}
