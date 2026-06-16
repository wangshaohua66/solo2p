using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Evidence> Evidences { get; set; }
    public DbSet<ChainRecord> ChainRecords { get; set; }
    public DbSet<ExaminationTask> ExaminationTasks { get; set; }
    public DbSet<ExaminationRecord> ExaminationRecords { get; set; }
    public DbSet<InventoryTask> InventoryTasks { get; set; }
    public DbSet<InventoryItem> InventoryItems { get; set; }
    public DbSet<DestroyRequest> DestroyRequests { get; set; }
    public DbSet<OverdueWarning> OverdueWarnings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(b =>
        {
            b.HasIndex(u => u.Username).IsUnique();
            b.HasIndex(u => u.EmployeeId).IsUnique();
            b.Property(u => u.Username).HasMaxLength(50).IsRequired();
            b.Property(u => u.PasswordHash).HasMaxLength(256).IsRequired();
            b.Property(u => u.RealName).HasMaxLength(50).IsRequired();
            b.Property(u => u.EmployeeId).HasMaxLength(50).IsRequired();
            b.Property(u => u.Department).HasMaxLength(100);
            b.Property(u => u.Phone).HasMaxLength(20);
            b.Property(u => u.Email).HasMaxLength(100);
        });

        modelBuilder.Entity<Evidence>(b =>
        {
            b.HasIndex(e => e.Barcode).IsUnique();
            b.HasIndex(e => e.CaseNumber);
            b.HasIndex(e => e.Status);
            b.HasIndex(e => e.Category);
            b.HasIndex(e => e.CreatedAt);
            b.HasIndex(e => e.ExpectedExpiryDate);
            b.Property(e => e.Barcode).HasMaxLength(50).IsRequired();
            b.Property(e => e.CategoryCode).HasMaxLength(10).IsRequired();
            b.Property(e => e.Name).HasMaxLength(200).IsRequired();
            b.Property(e => e.CaseNumber).HasMaxLength(50);
            b.Property(e => e.ExtractionLocation).HasMaxLength(200).IsRequired();
            b.Property(e => e.ExtractedBy).HasMaxLength(50).IsRequired();
            b.Property(e => e.PackagingMethod).HasMaxLength(200).IsRequired();
            b.Property(e => e.StorageLocation).HasMaxLength(100);
            b.Property(e => e.ShelfNumber).HasMaxLength(50);
            b.Property(e => e.SuspectInfo).HasMaxLength(500);
            b.Property(e => e.DestroyRemark).HasMaxLength(500);
        });

        modelBuilder.Entity<ChainRecord>(b =>
        {
            b.HasIndex(c => c.EvidenceId);
            b.HasIndex(c => c.OperatorId);
            b.HasIndex(c => c.OperationTime);
            b.HasIndex(c => c.OperationType);
            b.HasIndex(c => c.RecordHash).IsUnique();
            b.HasIndex(c => new { c.EvidenceId, c.SequenceNumber }).IsUnique();
            b.Property(c => c.OperatorName).HasMaxLength(50).IsRequired();
            b.Property(c => c.FromDepartment).HasMaxLength(100);
            b.Property(c => c.ToDepartment).HasMaxLength(100);
            b.Property(c => c.ImageHash).HasMaxLength(64);
            b.Property(c => c.Remark).HasMaxLength(500);
            b.Property(c => c.PreviousRecordHash).HasMaxLength(64);
            b.Property(c => c.RecordHash).HasMaxLength(64).IsRequired();

            b.HasOne(c => c.Evidence)
             .WithMany(e => e.ChainRecords)
             .HasForeignKey(c => c.EvidenceId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(c => c.Operator)
             .WithMany(u => u.ChainRecords)
             .HasForeignKey(c => c.OperatorId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ExaminationTask>(b =>
        {
            b.HasIndex(e => e.EvidenceId);
            b.HasIndex(e => e.ExaminerId);
            b.HasIndex(e => e.ReviewerId);
            b.HasIndex(e => e.Status);
            b.HasIndex(e => e.TaskNumber).IsUnique();
            b.HasIndex(e => e.CreatedAt);
            b.Property(e => e.TaskNumber).HasMaxLength(50).IsRequired();
            b.Property(e => e.ExaminationType).HasMaxLength(100).IsRequired();
            b.Property(e => e.InstrumentInfo).HasMaxLength(500);
            b.Property(e => e.ReviewOpinion).HasMaxLength(1000);
            b.Property(e => e.RejectReason).HasMaxLength(1000);

            b.HasOne(e => e.Evidence)
             .WithMany(e => e.ExaminationTasks)
             .HasForeignKey(e => e.EvidenceId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Examiner)
             .WithMany(u => u.ExaminationTasksAsExaminer)
             .HasForeignKey(e => e.ExaminerId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(e => e.Reviewer)
             .WithMany(u => u.ExaminationTasksAsReviewer)
             .HasForeignKey(e => e.ReviewerId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ExaminationRecord>(b =>
        {
            b.HasIndex(e => e.ExaminationTaskId);
            b.HasIndex(e => e.RecordedById);
            b.HasIndex(e => e.RecordedAt);
            b.Property(e => e.InstrumentUsed).HasMaxLength(200);
            b.Property(e => e.ImageHash).HasMaxLength(64);

            b.HasOne(e => e.ExaminationTask)
             .WithMany(t => t.ExaminationRecords)
             .HasForeignKey(e => e.ExaminationTaskId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InventoryTask>(b =>
        {
            b.HasIndex(i => i.Status);
            b.HasIndex(i => i.Warehouse);
            b.HasIndex(i => i.Category);
            b.HasIndex(i => i.CaseNumber);
            b.HasIndex(i => i.CreatedAt);
            b.Property(i => i.TaskNumber).HasMaxLength(50).IsRequired();
            b.HasIndex(i => i.TaskNumber).IsUnique();
            b.Property(i => i.Warehouse).HasMaxLength(100);
            b.Property(i => i.CaseNumber).HasMaxLength(50);
            b.Property(i => i.ExceptionReport).HasMaxLength(2000);
        });

        modelBuilder.Entity<InventoryItem>(b =>
        {
            b.HasIndex(i => i.InventoryTaskId);
            b.HasIndex(i => i.EvidenceId);
            b.HasIndex(i => i.Barcode);
            b.Property(i => i.Barcode).HasMaxLength(50).IsRequired();
            b.Property(i => i.EvidenceName).HasMaxLength(200).IsRequired();
            b.Property(i => i.Remark).HasMaxLength(500);

            b.HasOne(i => i.InventoryTask)
             .WithMany(t => t.InventoryItems)
             .HasForeignKey(i => i.InventoryTaskId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(i => i.Evidence)
             .WithMany(e => e.InventoryItems)
             .HasForeignKey(i => i.EvidenceId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DestroyRequest>(b =>
        {
            b.HasIndex(d => d.EvidenceId);
            b.HasIndex(d => d.RequestedById);
            b.HasIndex(d => d.ApprovedById);
            b.HasIndex(d => d.IsApproved);
            b.HasIndex(d => d.IsExecuted);
            b.HasIndex(d => d.RequestedAt);
            b.Property(d => d.RequestNumber).HasMaxLength(50).IsRequired();
            b.HasIndex(d => d.RequestNumber).IsUnique();
            b.Property(d => d.Reason).HasMaxLength(500).IsRequired();
            b.Property(d => d.ApprovalOpinion).HasMaxLength(1000);
            b.Property(d => d.Executor1Name).HasMaxLength(50);
            b.Property(d => d.Executor2Name).HasMaxLength(50);
            b.Property(d => d.ImageHash).HasMaxLength(64);
            b.Property(d => d.Remark).HasMaxLength(500);

            b.HasOne(d => d.Evidence)
             .WithMany()
             .HasForeignKey(d => d.EvidenceId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OverdueWarning>(b =>
        {
            b.HasIndex(o => o.EvidenceId);
            b.HasIndex(o => o.IsWarning);
            b.HasIndex(o => o.IsOverdue);
            b.HasIndex(o => o.GeneratedAt);
            b.HasIndex(o => o.Resolved);
            b.Property(o => o.Barcode).HasMaxLength(50).IsRequired();
            b.Property(o => o.EvidenceName).HasMaxLength(200).IsRequired();
            b.Property(o => o.ResolveRemark).HasMaxLength(500);

            b.HasOne(o => o.Evidence)
             .WithMany()
             .HasForeignKey(o => o.EvidenceId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
