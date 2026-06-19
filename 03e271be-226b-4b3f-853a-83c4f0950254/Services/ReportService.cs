using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface IReportService
{
    Task<List<ProductionTrendDto>> GetProductionTrendAsync(ReportQueryDto query);
    Task<List<FeeCollectionDto>> GetFeeCollectionAsync(ReportQueryDto query);
    Task<List<SafetyDisposalDto>> GetSafetyDisposalStatsAsync(ReportQueryDto query);
    Task<List<MiningRightExpiryDto>> GetExpiringMiningRightsAsync(int daysAhead = 90);
    Task<List<MineStatDto>> GetMineStatsAsync(ReportQueryDto query);
    Task ProcessOverdueFeesAsync();
}

public class ReportService : IReportService
{
    private readonly AppDbContext _dbContext;

    public ReportService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<ProductionTrendDto>> GetProductionTrendAsync(ReportQueryDto query)
    {
        var q = _dbContext.ProductionReports
            .Include(pr => pr.Mine)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(pr => pr.MineId == query.MineId.Value);
        if (query.MineType.HasValue)
            q = q.Where(pr => pr.Mine != null && pr.Mine.MineType == query.MineType.Value);
        if (!string.IsNullOrEmpty(query.Area))
            q = q.Where(pr => pr.Mine != null && pr.Mine.Area == query.Area);
        if (query.StartTime.HasValue)
        {
            var startYear = query.StartTime.Value.Year;
            var startMonth = query.StartTime.Value.Month;
            q = q.Where(pr => pr.Year > startYear || (pr.Year == startYear && pr.Month >= startMonth));
        }
        if (query.EndTime.HasValue)
        {
            var endYear = query.EndTime.Value.Year;
            var endMonth = query.EndTime.Value.Month;
            q = q.Where(pr => pr.Year < endYear || (pr.Year == endYear && pr.Month <= endMonth));
        }

        var reports = await q
            .OrderBy(pr => pr.Year)
            .ThenBy(pr => pr.Month)
            .ToListAsync();

        return reports.Select(pr => new ProductionTrendDto
        {
            Period = $"{pr.Year}-{pr.Month:D2}",
            MineId = pr.MineId,
            MineName = pr.Mine?.Name ?? string.Empty,
            MineType = pr.Mine?.MineType ?? MineType.NonMetal,
            Output = pr.Output,
            Sales = pr.Sales,
            Grade = pr.Grade
        }).ToList();
    }

    public async Task<List<FeeCollectionDto>> GetFeeCollectionAsync(ReportQueryDto query)
    {
        var q = _dbContext.FeeRecords
            .Include(fr => fr.MiningRight)
                .ThenInclude(mr => mr.Mine)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(fr => fr.MiningRight != null && fr.MiningRight.MineId == query.MineId.Value);
        if (query.MineType.HasValue)
            q = q.Where(fr => fr.MiningRight != null && fr.MiningRight.Mine != null && fr.MiningRight.Mine.MineType == query.MineType.Value);
        if (!string.IsNullOrEmpty(query.Area))
            q = q.Where(fr => fr.MiningRight != null && fr.MiningRight.Mine != null && fr.MiningRight.Mine.Area == query.Area);

        var fees = await q.ToListAsync();

        return fees
            .GroupBy(fr => $"{fr.Year}-Q{fr.Quarter}")
            .Select(g => new FeeCollectionDto
            {
                Period = g.Key,
                TotalBilled = g.Sum(fr => fr.TotalAmount),
                TotalPaid = g.Sum(fr => fr.PaidAmount),
                TotalOverdue = g.Where(fr => fr.Status == FeeStatus.Overdue).Sum(fr => fr.TotalAmount + fr.LateFee - fr.PaidAmount)
            })
            .OrderBy(x => x.Period)
            .ToList();
    }

    public async Task<List<SafetyDisposalDto>> GetSafetyDisposalStatsAsync(ReportQueryDto query)
    {
        var q = _dbContext.SafetyAlerts
            .Include(sa => sa.Mine)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(sa => sa.MineId == query.MineId.Value);
        if (query.StartTime.HasValue)
            q = q.Where(sa => sa.CreatedAt >= query.StartTime.Value);
        if (query.EndTime.HasValue)
            q = q.Where(sa => sa.CreatedAt <= query.EndTime.Value);

        var alerts = await q.ToListAsync();

        return alerts
            .GroupBy(sa => new { sa.MineId, sa.Mine?.Name })
            .Select(g =>
            {
                var respondedItems = g.Where(sa => sa.RespondedAt.HasValue && sa.AssignedAt.HasValue).ToList();
                var closedItems = g.Where(sa => sa.ClosedAt.HasValue).ToList();
                return new SafetyDisposalDto
                {
                    MineId = g.Key.MineId,
                    MineName = g.Key.Name ?? string.Empty,
                    TotalAlerts = g.Count(),
                    ClosedAlerts = g.Count(sa => sa.Status == AlertStatus.Closed),
                    PendingAlerts = g.Count(sa => sa.Status == AlertStatus.Created || sa.Status == AlertStatus.Assigned || sa.Status == AlertStatus.Responded),
                    EscalatedAlerts = g.Count(sa => sa.Status == AlertStatus.Escalated),
                    AvgResponseHours = respondedItems.Count > 0
                        ? respondedItems.Average(sa => (sa.RespondedAt!.Value - sa.AssignedAt!.Value).TotalHours)
                        : 0,
                    AvgCloseHours = closedItems.Count > 0
                        ? closedItems.Average(sa => (sa.ClosedAt!.Value - sa.CreatedAt).TotalHours)
                        : 0
                };
            })
            .ToList();
    }

    public async Task<List<MiningRightExpiryDto>> GetExpiringMiningRightsAsync(int daysAhead = 90)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(daysAhead);
        var expiringRights = await _dbContext.MiningRights
            .Include(mr => mr.Mine)
            .Where(mr => mr.Status == MiningRightStatus.Active && mr.ValidTo <= cutoffDate)
            .OrderBy(mr => mr.ValidTo)
            .ToListAsync();

        return expiringRights.Select(mr => new MiningRightExpiryDto
        {
            Id = mr.Id,
            LicenseNo = mr.LicenseNo,
            MineId = mr.MineId,
            MineName = mr.Mine?.Name ?? string.Empty,
            Holder = mr.Holder,
            ValidTo = mr.ValidTo,
            DaysToExpiry = (mr.ValidTo - DateTime.UtcNow).Days
        }).ToList();
    }

    public async Task<List<MineStatDto>> GetMineStatsAsync(ReportQueryDto query)
    {
        var mines = await _dbContext.Mines
            .Include(m => m.ProductionReports)
            .Include(m => m.SafetyAlerts)
            .Include(m => m.MiningRights)
                .ThenInclude(mr => mr.FeeRecords)
            .AsQueryable()
            .ToListAsync();

        if (query.MineType.HasValue)
            mines = mines.Where(m => m.MineType == query.MineType.Value).ToList();
        if (!string.IsNullOrEmpty(query.Area))
            mines = mines.Where(m => m.Area == query.Area).ToList();
        if (query.MineId.HasValue)
            mines = mines.Where(m => m.Id == query.MineId.Value).ToList();

        return mines.Select(m => new MineStatDto
        {
            Id = m.Id,
            Name = m.Name,
            MineType = m.MineType,
            TotalProductionReports = m.ProductionReports.Count,
            AbnormalReports = m.ProductionReports.Count(pr => pr.IsAbnormal),
            TotalAlerts = m.SafetyAlerts.Count,
            OpenAlerts = m.SafetyAlerts.Count(sa => sa.Status != AlertStatus.Closed),
            TotalFeesBilled = m.MiningRights.SelectMany(mr => mr.FeeRecords).Sum(fr => fr.TotalAmount),
            TotalFeesPaid = m.MiningRights.SelectMany(mr => mr.FeeRecords).Sum(fr => fr.PaidAmount)
        }).ToList();
    }

    public async Task ProcessOverdueFeesAsync()
    {
        var today = DateTime.UtcNow;
        var overdueThreshold = 30;

        var billedFees = await _dbContext.FeeRecords
            .Where(fr => fr.Status == FeeStatus.Billed || fr.Status == FeeStatus.Pending)
            .ToListAsync();

        foreach (var fee in billedFees)
        {
            var daysOverdue = (today - fee.DueDate).Days;
            if (daysOverdue > 0)
            {
                if (daysOverdue >= overdueThreshold && fee.Status == FeeStatus.Billed)
                {
                    fee.Status = FeeStatus.Overdue;
                    fee.RemindedAt = today;
                }

                if (daysOverdue > 0)
                {
                    var principal = fee.TotalAmount - fee.PaidAmount;
                    if (principal > 0)
                    {
                        fee.LateFee = principal * 0.001m * daysOverdue;
                    }
                }
            }
        }

        await _dbContext.SaveChangesAsync();
    }
}
