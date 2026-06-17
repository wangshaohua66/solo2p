using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Interfaces.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace BloodCenter.Infrastructure.Data.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly BloodCenterDbContext _context;
    private IDbContextTransaction? _transaction;

    public UnitOfWork(BloodCenterDbContext context)
    {
        _context = context;
        Users = new Repository<User>(context);
        Donors = new Repository<Donor>(context);
        DonorMedicalHistories = new Repository<DonorMedicalHistory>(context);
        CollectionSites = new Repository<CollectionSite>(context);
        Donations = new Repository<Donation>(context);
        InitialScreenings = new Repository<InitialScreening>(context);
        BloodTests = new Repository<BloodTest>(context);
        BloodProducts = new Repository<BloodProduct>(context);
        Hospitals = new Repository<Hospital>(context);
        BloodRequests = new Repository<BloodRequest>(context);
        CrossMatches = new Repository<CrossMatch>(context);
        ScrapRecords = new Repository<ScrapRecord>(context);
        InventorySettings = new Repository<InventorySetting>(context);
        DeferralSettings = new Repository<DeferralSettings>(context);
    }

    public IRepository<User> Users { get; private set; }
    public IRepository<Donor> Donors { get; private set; }
    public IRepository<DonorMedicalHistory> DonorMedicalHistories { get; private set; }
    public IRepository<CollectionSite> CollectionSites { get; private set; }
    public IRepository<Donation> Donations { get; private set; }
    public IRepository<InitialScreening> InitialScreenings { get; private set; }
    public IRepository<BloodTest> BloodTests { get; private set; }
    public IRepository<BloodProduct> BloodProducts { get; private set; }
    public IRepository<Hospital> Hospitals { get; private set; }
    public IRepository<BloodRequest> BloodRequests { get; private set; }
    public IRepository<CrossMatch> CrossMatches { get; private set; }
    public IRepository<ScrapRecord> ScrapRecords { get; private set; }
    public IRepository<InventorySetting> InventorySettings { get; private set; }
    public IRepository<DeferralSettings> DeferralSettings { get; private set; }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }

    public int SaveChanges()
    {
        return _context.SaveChanges();
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        _transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync(cancellationToken);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync(cancellationToken);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task<List<(BloodType BloodType, RhFactor RhFactor, int Count)>> GroupInStockProductsByBloodTypeAsync(CancellationToken cancellationToken = default)
    {
        var results = await _context.BloodProducts
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.InStock)
            .GroupBy(bp => new { bp.BloodGroup.ABO, bp.BloodGroup.Rh })
            .Select(g => new { g.Key.ABO, g.Key.Rh, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return results
            .Select(x => (x.ABO, x.Rh, x.Count))
            .ToList();
    }

    public async Task<List<(BloodType BloodType, RhFactor RhFactor, int Count)>> GroupIssuedProductsByBloodTypeAsync(DateTime sinceDate, CancellationToken cancellationToken = default)
    {
        var results = await _context.BloodProducts
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.Issued && bp.UpdatedAt >= sinceDate)
            .GroupBy(bp => new { bp.BloodGroup.ABO, bp.BloodGroup.Rh })
            .Select(g => new { g.Key.ABO, g.Key.Rh, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return results
            .Select(x => (x.ABO, x.Rh, x.Count))
            .ToList();
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
        GC.SuppressFinalize(this);
    }
}
