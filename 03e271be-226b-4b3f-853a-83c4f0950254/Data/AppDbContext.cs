using Microsoft.EntityFrameworkCore;
using MiningGovApi.Models;

namespace MiningGovApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Mine> Mines { get; set; }
    public DbSet<MiningRight> MiningRights { get; set; }
    public DbSet<MiningRightApproval> MiningRightApprovals { get; set; }
    public DbSet<ProductionReport> ProductionReports { get; set; }
    public DbSet<SensorThreshold> SensorThresholds { get; set; }
    public DbSet<SensorData> SensorData { get; set; }
    public DbSet<SafetyAlert> SafetyAlerts { get; set; }
    public DbSet<SafetyAlertDisposal> SafetyAlertDisposals { get; set; }
    public DbSet<TradeOrder> TradeOrders { get; set; }
    public DbSet<FeeRecord> FeeRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasOne(u => u.Mine)
                  .WithMany()
                  .HasForeignKey(u => u.MineId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Mine>(entity =>
        {
            entity.HasIndex(m => m.RegistrationNo).IsUnique();
        });

        modelBuilder.Entity<MiningRight>(entity =>
        {
            entity.HasIndex(mr => mr.LicenseNo).IsUnique();
            entity.HasOne(mr => mr.Mine)
                  .WithMany(m => m.MiningRights)
                  .HasForeignKey(mr => mr.MineId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MiningRightApproval>(entity =>
        {
            entity.HasOne(a => a.MiningRight)
                  .WithMany(mr => mr.Approvals)
                  .HasForeignKey(a => a.MiningRightId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(a => a.Approver)
                  .WithMany()
                  .HasForeignKey(a => a.ApproverId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProductionReport>(entity =>
        {
            entity.HasIndex(pr => new { pr.MineId, pr.Year, pr.Month });
            entity.HasOne(pr => pr.Mine)
                  .WithMany(m => m.ProductionReports)
                  .HasForeignKey(pr => pr.MineId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(pr => pr.Reporter)
                  .WithMany()
                  .HasForeignKey(pr => pr.ReporterId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(pr => pr.Verifier)
                  .WithMany()
                  .HasForeignKey(pr => pr.VerifierId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SensorThreshold>(entity =>
        {
            entity.HasIndex(st => new { st.MineId, st.SensorCode }).IsUnique();
            entity.HasOne(st => st.Mine)
                  .WithMany(m => m.SensorThresholds)
                  .HasForeignKey(st => st.MineId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SensorData>(entity =>
        {
            entity.HasIndex(sd => new { sd.MineId, sd.Timestamp });
        });

        modelBuilder.Entity<SafetyAlert>(entity =>
        {
            entity.HasOne(sa => sa.Mine)
                  .WithMany(m => m.SafetyAlerts)
                  .HasForeignKey(sa => sa.MineId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(sa => sa.AssignedInspector)
                  .WithMany()
                  .HasForeignKey(sa => sa.AssignedInspectorId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(sa => sa.EscalatedTo)
                  .WithMany()
                  .HasForeignKey(sa => sa.EscalatedToId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SafetyAlertDisposal>(entity =>
        {
            entity.HasOne(d => d.SafetyAlert)
                  .WithMany(sa => sa.Disposals)
                  .HasForeignKey(d => d.SafetyAlertId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(d => d.Handler)
                  .WithMany()
                  .HasForeignKey(d => d.HandlerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TradeOrder>(entity =>
        {
            entity.HasOne(to => to.MiningRight)
                  .WithMany(mr => mr.TradeOrders)
                  .HasForeignKey(to => to.MiningRightId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(to => to.Reviewer)
                  .WithMany()
                  .HasForeignKey(to => to.ReviewerId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(to => to.Rechecker)
                  .WithMany()
                  .HasForeignKey(to => to.RecheckerId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FeeRecord>(entity =>
        {
            entity.HasIndex(fr => new { fr.MiningRightId, fr.Year, fr.Quarter });
            entity.HasOne(fr => fr.MiningRight)
                  .WithMany(mr => mr.FeeRecords)
                  .HasForeignKey(fr => fr.MiningRightId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
