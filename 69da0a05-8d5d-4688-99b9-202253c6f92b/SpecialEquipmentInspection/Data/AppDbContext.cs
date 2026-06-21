using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Inspection> Inspections => Set<Inspection>();
    public DbSet<InspectionItem> InspectionItems => Set<InspectionItem>();
    public DbSet<Inspector> Inspectors => Set<Inspector>();
    public DbSet<User> Users => Set<User>();
    public DbSet<InspectionPlan> InspectionPlans => Set<InspectionPlan>();
    public DbSet<Rectification> Rectifications => Set<Rectification>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<SupervisionReport> SupervisionReports => Set<SupervisionReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Device>(b =>
        {
            b.HasIndex(d => d.DeviceCode).IsUnique();
            b.HasIndex(d => d.UseUnitCode);
            b.HasIndex(d => d.Region);
            b.HasIndex(d => d.NextInspectionDate);
            b.Property(d => d.TechnicalParameters).HasMaxLength(2048);
            b.Property(d => d.Status).HasConversion<int>();
            b.Property(d => d.Type).HasConversion<int>();
        });

        modelBuilder.Entity<Inspection>(b =>
        {
            b.HasIndex(i => i.InspectionCode).IsUnique();
            b.HasIndex(i => i.DeviceId);
            b.HasIndex(i => i.InspectorId);
            b.HasIndex(i => i.Status);
            b.HasIndex(i => i.ScheduledDate);
            b.Property(i => i.Status).HasConversion<int>();
            b.Property(i => i.Result).HasConversion<int>();
            b.Property(i => i.DeviceType).HasConversion<int>();
            b.Property(i => i.Photos).HasMaxLength(8192);
            b.Property(i => i.Conclusion).HasMaxLength(2048);
            b.Property(i => i.Findings).HasMaxLength(2048);
            b.HasOne(i => i.Device)
                .WithMany(d => d.Inspections)
                .HasForeignKey(i => i.DeviceId)
                .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(i => i.Plan)
                .WithMany(p => p.Inspections)
                .HasForeignKey(i => i.PlanId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<InspectionItem>(b =>
        {
            b.HasIndex(t => t.InspectionId);
            b.Property(t => t.Result).HasConversion<int>();
            b.Property(t => t.Data).HasMaxLength(2048);
            b.Property(t => t.Description).HasMaxLength(2048);
            b.HasOne(t => t.Inspection)
                .WithMany(i => i.Items)
                .HasForeignKey(t => t.InspectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Inspector>(b =>
        {
            b.HasIndex(x => x.CertificateNo).IsUnique();
            b.Property(x => x.Status).HasConversion<int>();
            b.Property(x => x.CertifiableTypes).HasMaxLength(128);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.HasIndex(u => u.Username).IsUnique();
            b.Property(u => u.Role).HasConversion<int>();
            b.Property(u => u.PasswordHash).HasMaxLength(256);
        });

        modelBuilder.Entity<InspectionPlan>(b =>
        {
            b.HasIndex(p => p.PlanCode).IsUnique();
            b.HasIndex(p => p.Year);
            b.Property(p => p.Status).HasConversion<int>();
            b.Property(p => p.DeviceType).HasConversion<int>();
        });

        modelBuilder.Entity<Rectification>(b =>
        {
            b.HasIndex(r => r.InspectionId);
            b.HasIndex(r => r.Status);
            b.HasIndex(r => r.Deadline);
            b.Property(r => r.Status).HasConversion<int>();
            b.Property(r => r.Description).HasMaxLength(2048);
            b.Property(r => r.RectificationResult).HasMaxLength(2048);
            b.HasOne(r => r.Inspection)
                .WithMany(i => i.Rectifications)
                .HasForeignKey(r => r.InspectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Report>(b =>
        {
            b.HasIndex(r => r.ReportNo).IsUnique();
            b.HasIndex(r => r.InspectionId);
            b.Property(r => r.Status).HasConversion<int>();
            b.Property(r => r.Conclusion).HasConversion<int>();
            b.Property(r => r.DeviceInfo).HasMaxLength(4096);
            b.Property(r => r.ItemsSummary).HasMaxLength(8192);
            b.HasOne(r => r.Inspection)
                .WithMany()
                .HasForeignKey(r => r.InspectionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SupervisionReport>(b =>
        {
            b.HasIndex(s => s.ReportCode).IsUnique();
            b.HasIndex(s => s.DeviceId);
            b.HasIndex(s => s.Status);
            b.Property(s => s.Status).HasConversion<int>();
            b.Property(s => s.Payload).HasMaxLength(8192);
        });
    }
}
