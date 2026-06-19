using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface IProductionService
{
    Task<ProductionReportDto> CreateAsync(ProductionReportCreateDto dto, int reporterId);
    Task<int> BatchCreateAsync(List<ProductionReportCreateDto> dtos, int reporterId);
    Task<ProductionReportDto> GetByIdAsync(int id);
    Task<PagedResult<ProductionReportDto>> QueryAsync(ProductionReportQueryDto query);
    Task<ProductionReportDto> VerifyAsync(ProductionReportVerifyDto dto, int verifierId);
    Task CalculateFeesAsync(int year, int quarter);
}

public class ProductionService : IProductionService
{
    private readonly AppDbContext _dbContext;
    private const decimal AbnormalThreshold = 0.15m;

    public ProductionService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ProductionReportDto> CreateAsync(ProductionReportCreateDto dto, int reporterId)
    {
        var mine = await _dbContext.Mines.FindAsync(dto.MineId);
        if (mine == null)
        {
            throw new KeyNotFoundException($"矿山ID {dto.MineId} 不存在");
        }

        var existing = await _dbContext.ProductionReports
            .FirstOrDefaultAsync(pr => pr.MineId == dto.MineId && pr.Year == dto.Year && pr.Month == dto.Month);
        if (existing != null)
        {
            throw new InvalidOperationException($"{dto.Year}年{dto.Month}月的产量数据已存在");
        }

        var report = new ProductionReport
        {
            MineId = dto.MineId,
            ReporterId = reporterId,
            Year = dto.Year,
            Month = dto.Month,
            Output = dto.Output,
            Sales = dto.Sales,
            Grade = dto.Grade,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow
        };

        var (isAbnormal, reason) = await CheckAbnormalAsync(report);
        report.IsAbnormal = isAbnormal;
        report.AbnormalReason = reason;

        _dbContext.ProductionReports.Add(report);
        await _dbContext.SaveChangesAsync();

        return await MapToDtoAsync(report);
    }

    public async Task<int> BatchCreateAsync(List<ProductionReportCreateDto> dtos, int reporterId)
    {
        if (dtos == null || dtos.Count == 0)
            return 0;

        if (dtos.Count > 50)
        {
            throw new ArgumentException("单次批量上报不得超过50条");
        }

        var mineIds = dtos.Select(d => d.MineId).Distinct().ToList();
        var existingMines = await _dbContext.Mines
            .Where(m => mineIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id);

        var reports = new List<ProductionReport>();
        foreach (var dto in dtos)
        {
            if (!existingMines.ContainsKey(dto.MineId))
                continue;

            var exists = await _dbContext.ProductionReports
                .AnyAsync(pr => pr.MineId == dto.MineId && pr.Year == dto.Year && pr.Month == dto.Month);
            if (exists)
                continue;

            var report = new ProductionReport
            {
                MineId = dto.MineId,
                ReporterId = reporterId,
                Year = dto.Year,
                Month = dto.Month,
                Output = dto.Output,
                Sales = dto.Sales,
                Grade = dto.Grade,
                Remark = dto.Remark,
                CreatedAt = DateTime.UtcNow
            };

            var (isAbnormal, reason) = await CheckAbnormalAsync(report);
            report.IsAbnormal = isAbnormal;
            report.AbnormalReason = reason;

            reports.Add(report);
        }

        _dbContext.ProductionReports.AddRange(reports);
        return await _dbContext.SaveChangesAsync();
    }

    public async Task<ProductionReportDto> GetByIdAsync(int id)
    {
        var report = await _dbContext.ProductionReports
            .Include(pr => pr.Mine)
            .Include(pr => pr.Reporter)
            .Include(pr => pr.Verifier)
            .FirstOrDefaultAsync(pr => pr.Id == id);

        if (report == null)
        {
            throw new KeyNotFoundException($"产量报告ID {id} 不存在");
        }

        return await MapToDtoAsync(report);
    }

    public async Task<PagedResult<ProductionReportDto>> QueryAsync(ProductionReportQueryDto query)
    {
        var q = _dbContext.ProductionReports
            .Include(pr => pr.Mine)
            .Include(pr => pr.Reporter)
            .Include(pr => pr.Verifier)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(pr => pr.MineId == query.MineId.Value);
        if (query.Year.HasValue)
            q = q.Where(pr => pr.Year == query.Year.Value);
        if (query.Month.HasValue)
            q = q.Where(pr => pr.Month == query.Month.Value);
        if (query.IsAbnormal.HasValue)
            q = q.Where(pr => pr.IsAbnormal == query.IsAbnormal.Value);
        if (query.Verified.HasValue)
            q = q.Where(pr => pr.Verified == query.Verified.Value);

        var totalCount = await q.CountAsync();
        var items = await q
            .OrderByDescending(pr => pr.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var dtoTasks = items.Select(MapToDtoAsync);
        var dtos = (await Task.WhenAll(dtoTasks)).ToList();

        return new PagedResult<ProductionReportDto>
        {
            TotalCount = totalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize,
            Items = dtos
        };
    }

    public async Task<ProductionReportDto> VerifyAsync(ProductionReportVerifyDto dto, int verifierId)
    {
        var report = await _dbContext.ProductionReports.FindAsync(dto.ReportId);
        if (report == null)
        {
            throw new KeyNotFoundException($"产量报告ID {dto.ReportId} 不存在");
        }

        report.Verified = dto.Verified;
        report.VerifierId = verifierId;
        report.VerifiedAt = DateTime.UtcNow;
        report.VerificationNote = dto.VerificationNote;

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(dto.ReportId);
    }

    public async Task CalculateFeesAsync(int year, int quarter)
    {
        var months = Enumerable.Range((quarter - 1) * 3 + 1, 3).ToList();
        var reports = await _dbContext.ProductionReports
            .Include(pr => pr.Mine)
            .Where(pr => pr.Year == year && months.Contains(pr.Month) && pr.Verified == true)
            .ToListAsync();

        var groupedByMine = reports.GroupBy(pr => pr.MineId);

        foreach (var group in groupedByMine)
        {
            var miningRight = await _dbContext.MiningRights
                .FirstOrDefaultAsync(mr => mr.MineId == group.Key && mr.Status == MiningRightStatus.Active);
            if (miningRight == null) continue;

            var totalOutput = group.Sum(pr => pr.Output);
            var totalSales = group.Sum(pr => pr.Sales);

            var usageFee = CalculateUsageFee(totalOutput, miningRight.MineType);
            var compensationFee = CalculateCompensationFee(totalSales, miningRight.MineType);

            var existingFee = await _dbContext.FeeRecords
                .FirstOrDefaultAsync(fr => fr.MiningRightId == miningRight.Id && fr.Year == year && fr.Quarter == quarter);

            var billedAt = DateTime.UtcNow;
            var dueDate = billedAt.AddDays(30);

            if (existingFee == null)
            {
                _dbContext.FeeRecords.Add(new FeeRecord
                {
                    MiningRightId = miningRight.Id,
                    Year = year,
                    Quarter = quarter,
                    UsageFee = usageFee,
                    CompensationFee = compensationFee,
                    LateFee = 0,
                    PaidAmount = 0,
                    Status = FeeStatus.Billed,
                    BilledAt = billedAt,
                    DueDate = dueDate
                });
            }
            else
            {
                existingFee.UsageFee = usageFee;
                existingFee.CompensationFee = compensationFee;
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<(bool IsAbnormal, string? Reason)> CheckAbnormalAsync(ProductionReport report)
    {
        var historyReports = await _dbContext.ProductionReports
            .Where(pr => pr.MineId == report.MineId && pr.Id != report.Id)
            .OrderByDescending(pr => pr.Year * 12 + pr.Month)
            .Take(6)
            .ToListAsync();

        if (historyReports.Count >= 3)
        {
            var avgOutput = historyReports.Average(pr => pr.Output);
            if (avgOutput > 0 && Math.Abs(report.Output - avgOutput) / avgOutput > AbnormalThreshold)
            {
                return (true, $"产量与近6个月均值偏差超过15%");
            }

            var avgGrade = historyReports.Average(pr => pr.Grade);
            if (avgGrade > 0 && Math.Abs(report.Grade - avgGrade) / avgGrade > AbnormalThreshold)
            {
                return (true, $"品位与近6个月均值偏差超过15%");
            }
        }

        var sameAreaReports = await _dbContext.ProductionReports
            .Include(pr => pr.Mine)
            .Where(pr => pr.MineId != report.MineId && pr.Year == report.Year && pr.Month == report.Month)
            .ToListAsync();

        var currentMine = await _dbContext.Mines.FindAsync(report.MineId);
        if (currentMine != null && sameAreaReports.Count > 0)
        {
            var sameTypeReports = sameAreaReports
                .Where(pr => pr.Mine?.MineType == currentMine.MineType)
                .ToList();

            if (sameTypeReports.Count >= 3)
            {
                var areaAvgOutput = sameTypeReports.Average(pr => pr.Output);
                if (areaAvgOutput > 0 && Math.Abs(report.Output - areaAvgOutput) / areaAvgOutput > AbnormalThreshold)
                {
                    return (true, $"产量与同类型矿区当月均值偏差超过15%");
                }
            }
        }

        return (false, null);
    }

    private static decimal CalculateUsageFee(decimal output, MineType mineType)
    {
        var rate = mineType switch
        {
            MineType.Coal => 8.0m,
            MineType.Metal => 15.0m,
            MineType.NonMetal => 5.0m,
            MineType.SandAndGravel => 3.0m,
            _ => 5.0m
        };
        return output * rate;
    }

    private static decimal CalculateCompensationFee(decimal sales, MineType mineType)
    {
        var rate = mineType switch
        {
            MineType.Coal => 0.02m,
            MineType.Metal => 0.04m,
            MineType.NonMetal => 0.02m,
            MineType.SandAndGravel => 0.01m,
            _ => 0.02m
        };
        return sales * rate;
    }

    private async Task<ProductionReportDto> MapToDtoAsync(ProductionReport pr)
    {
        var mine = pr.Mine ?? await _dbContext.Mines.FindAsync(pr.MineId);
        return new ProductionReportDto
        {
            Id = pr.Id,
            MineId = pr.MineId,
            MineName = mine?.Name ?? string.Empty,
            ReporterId = pr.ReporterId,
            ReporterName = pr.Reporter?.RealName ?? string.Empty,
            Year = pr.Year,
            Month = pr.Month,
            Output = pr.Output,
            Sales = pr.Sales,
            Grade = pr.Grade,
            Remark = pr.Remark,
            CreatedAt = pr.CreatedAt,
            IsAbnormal = pr.IsAbnormal,
            AbnormalReason = pr.AbnormalReason,
            Verified = pr.Verified,
            VerifierId = pr.VerifierId,
            VerifierName = pr.Verifier?.RealName,
            VerifiedAt = pr.VerifiedAt,
            VerificationNote = pr.VerificationNote
        };
    }
}
