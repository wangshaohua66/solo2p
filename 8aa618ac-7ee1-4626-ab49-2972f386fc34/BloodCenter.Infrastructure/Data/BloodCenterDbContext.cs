using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace BloodCenter.Infrastructure.Data;

public class BloodCenterDbContext : DbContext
{
    public BloodCenterDbContext(DbContextOptions<BloodCenterDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Donor> Donors => Set<Donor>();
    public DbSet<DonorMedicalHistory> DonorMedicalHistories => Set<DonorMedicalHistory>();
    public DbSet<CollectionSite> CollectionSites => Set<CollectionSite>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<InitialScreening> InitialScreenings => Set<InitialScreening>();
    public DbSet<BloodTest> BloodTests => Set<BloodTest>();
    public DbSet<BloodProduct> BloodProducts => Set<BloodProduct>();
    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<BloodRequest> BloodRequests => Set<BloodRequest>();
    public DbSet<CrossMatch> CrossMatches => Set<CrossMatch>();
    public DbSet<ScrapRecord> ScrapRecords => Set<ScrapRecord>();
    public DbSet<InventorySetting> InventorySettings => Set<InventorySetting>();
    public DbSet<DeferralSettings> DeferralSettings => Set<DeferralSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BloodCenterDbContext).Assembly);
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
        var now = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
                entry.Entity.IsDeleted = false;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }

            if (entry.State == EntityState.Deleted)
            {
                entry.State = EntityState.Modified;
                entry.Entity.IsDeleted = true;
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}
