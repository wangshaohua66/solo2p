using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces.Data;

public interface IUnitOfWork : IDisposable
{
    IRepository<User> Users { get; }
    IRepository<Donor> Donors { get; }
    IRepository<DonorMedicalHistory> DonorMedicalHistories { get; }
    IRepository<CollectionSite> CollectionSites { get; }
    IRepository<Donation> Donations { get; }
    IRepository<InitialScreening> InitialScreenings { get; }
    IRepository<BloodTest> BloodTests { get; }
    IRepository<BloodProduct> BloodProducts { get; }
    IRepository<Hospital> Hospitals { get; }
    IRepository<BloodRequest> BloodRequests { get; }
    IRepository<CrossMatch> CrossMatches { get; }
    IRepository<ScrapRecord> ScrapRecords { get; }
    IRepository<InventorySetting> InventorySettings { get; }
    IRepository<DeferralSettings> DeferralSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    int SaveChanges();
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);

    Task<List<(BloodType BloodType, RhFactor RhFactor, int Count)>> GroupInStockProductsByBloodTypeAsync(CancellationToken cancellationToken = default);
    Task<List<(BloodType BloodType, RhFactor RhFactor, int Count)>> GroupIssuedProductsByBloodTypeAsync(DateTime sinceDate, CancellationToken cancellationToken = default);
}
