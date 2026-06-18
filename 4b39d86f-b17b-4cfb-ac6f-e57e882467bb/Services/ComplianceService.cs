using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Services;

public class ComplianceService : IComplianceService
{
    private readonly IBaseRepository<ChemicalBatch> _batchRepo;
    private readonly IBaseRepository<TransportRecord> _transportRepo;
    private readonly IBaseRepository<Inventory> _inventoryRepo;
    private readonly IBaseRepository<HazardRectification> _hazardRepo;
    private readonly IBaseRepository<EmergencyDrill> _drillRepo;
    private readonly IBaseRepository<Certificate> _certRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly ICertificateService _certService;
    private readonly IMapper _mapper;

    public ComplianceService(
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<TransportRecord> transportRepo,
        IBaseRepository<Inventory> inventoryRepo,
        IBaseRepository<HazardRectification> hazardRepo,
        IBaseRepository<EmergencyDrill> drillRepo,
        IBaseRepository<Certificate> certRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        ICertificateService certService,
        IMapper mapper)
    {
        _batchRepo = batchRepo;
        _transportRepo = transportRepo;
        _inventoryRepo = inventoryRepo;
        _hazardRepo = hazardRepo;
        _drillRepo = drillRepo;
        _certRepo = certRepo;
        _enterpriseRepo = enterpriseRepo;
        _certService = certService;
        _mapper = mapper;
    }

    public async Task<ComplianceReportDto> GenerateMonthlyReportAsync(int year, int month, int? enterpriseId = null)
    {
        var startDate = new DateTime(year, month, 1);
        var endDate = startDate.AddMonths(1);

        var batchQuery = _batchRepo.GetQueryable()
            .Where(b => b.CreatedAt >= startDate && b.CreatedAt < endDate);

        var transportQuery = _transportRepo.GetQueryable()
            .Where(t => t.CreatedAt >= startDate && t.CreatedAt < endDate);

        var inventoryQuery = _inventoryRepo.GetQueryable();

        var hazardQuery = _hazardRepo.GetQueryable()
            .Where(h => h.CreatedAt >= startDate && h.CreatedAt < endDate);

        var drillQuery = _drillRepo.GetQueryable()
            .Where(d => d.Year == year && d.Quarter == (month - 1) / 3 + 1);

        var certQuery = _certRepo.GetQueryable();

        if (enterpriseId.HasValue)
        {
            batchQuery = batchQuery.Where(b => b.EnterpriseId == enterpriseId.Value);
            transportQuery = transportQuery.Where(t => t.EnterpriseId == enterpriseId.Value);
            inventoryQuery = inventoryQuery.Where(i => i.EnterpriseId == enterpriseId.Value);
            hazardQuery = hazardQuery.Where(h => h.EnterpriseId == enterpriseId.Value);
            drillQuery = drillQuery.Where(d => d.EnterpriseId == enterpriseId.Value);
            certQuery = certQuery.Where(c => c.EnterpriseId == enterpriseId.Value);
        }

        var totalBatches = await batchQuery.CountAsync();
        var qualifiedBatches = await batchQuery.CountAsync(b => b.InspectionPassed == true);
        var unqualifiedBatches = await batchQuery.CountAsync(b => b.InspectionPassed == false);

        var totalInventory = await inventoryQuery.CountAsync();
        var overstockInventory = await inventoryQuery.CountAsync(i => i.HasOverstockAlert);
        var lowStockInventory = await inventoryQuery.CountAsync(i => i.HasLowStockAlert);
        var nearExpiryInventory = await inventoryQuery.CountAsync(i => i.HasExpiryAlert);

        var totalTransports = await transportQuery.CountAsync();
        var completedTransports = await transportQuery.CountAsync(t => t.Status == TransportStatus.Completed);
        var anomalyTransports = await transportQuery.CountAsync(t =>
            t.IsDeviating || t.IsOverspeeding || t.IsTemperatureAbnormal);

        var totalHazards = await hazardQuery.CountAsync();
        var closedHazards = await hazardQuery.CountAsync(h =>
            h.Status == HazardRectificationStatus.Accepted || h.Status == HazardRectificationStatus.Closed);
        var overdueHazards = await hazardQuery.CountAsync(h => h.Status == HazardRectificationStatus.Overdue);

        var plannedDrills = await drillQuery.CountAsync();
        var completedDrills = await drillQuery.CountAsync(d =>
            d.Status == DrillStatus.Completed || d.Status == DrillStatus.Evaluated);
        var overdueDrills = await drillQuery.CountAsync(d => d.Status == DrillStatus.Overdue);

        var validCerts = await certQuery.CountAsync(c => c.Status == CertificateStatus.Valid);
        var expiringCerts = await certQuery.CountAsync(c => c.Status == CertificateStatus.Expiring);
        var expiredCerts = await certQuery.CountAsync(c => c.Status == CertificateStatus.Expired);

        var score = await CalculateEnterpriseComplianceScoreAsync(enterpriseId ?? 0, year, month);

        var issues = new List<string>();
        var recommendations = new List<string>();

        if (overdueHazards > 0)
        {
            issues.Add($"存在{overdueHazards}项隐患整改逾期未完成");
            recommendations.Add("请立即督办逾期隐患整改，对责任企业进行约谈");
        }

        if (overdueDrills > 0)
        {
            issues.Add($"存在{overdueDrills}个应急演练未按计划执行");
            recommendations.Add("请督促企业按计划开展应急演练，未执行的责令限期整改");
        }

        if (expiredCerts > 0)
        {
            issues.Add($"存在{expiredCerts}个资质证书已过期");
            recommendations.Add("请立即核查过期证书，暂停相关作业活动直至证书更新");
        }

        if (anomalyTransports > 0)
        {
            issues.Add($"本月存在{anomalyTransports}次运输异常");
            recommendations.Add("加强运输过程监控，对异常运输企业进行重点检查");
        }

        var enterprise = enterpriseId.HasValue ? await _enterpriseRepo.GetByIdAsync(enterpriseId.Value) : null;

        return new ComplianceReportDto
        {
            ReportNo = $"COMP-{year}{month:D2}-{(enterpriseId ?? 0):D4}",
            Year = year,
            Month = month,
            EnterpriseId = enterpriseId,
            EnterpriseName = enterprise?.Name,
            GeneratedAt = DateTime.UtcNow,
            TotalBatches = totalBatches,
            QualifiedBatches = qualifiedBatches,
            UnqualifiedBatches = unqualifiedBatches,
            InTransitTransports = await transportQuery.CountAsync(t => t.Status == TransportStatus.InTransit),
            CompletedTransports = completedTransports,
            AnomalyTransports = anomalyTransports,
            TotalInventory = totalInventory,
            OverstockInventory = overstockInventory,
            LowStockInventory = lowStockInventory,
            NearExpiryInventory = nearExpiryInventory,
            TotalHazards = totalHazards,
            ClosedHazards = closedHazards,
            OverdueHazards = overdueHazards,
            PlannedDrills = plannedDrills,
            CompletedDrills = completedDrills,
            OverdueDrills = overdueDrills,
            ValidCertificates = validCerts,
            ExpiringCertificates = expiringCerts,
            ExpiredCertificates = expiredCerts,
            ComplianceScore = score,
            ComplianceLevel = GetComplianceLevel(score),
            Issues = issues.Any() ? issues : null,
            Recommendations = recommendations.Any() ? recommendations : null
        };
    }

    public async Task<CertificateVerificationResultDto> VerifyCertificateAsync(CertificateVerifyDto dto)
    {
        var cert = await _certRepo.FirstOrDefaultAsync(c =>
            c.CertificateNo == dto.CertificateNo &&
            c.Type == (CertificateType)dto.Type &&
            c.HolderName == dto.HolderName);

        if (cert == null)
        {
            return new CertificateVerificationResultDto
            {
                IsValid = false,
                Message = "证书不存在",
                CertificateNo = dto.CertificateNo,
                HolderName = dto.HolderName,
                VerifiedAt = DateTime.UtcNow
            };
        }

        if (cert.Status == CertificateStatus.Expired || cert.Status == CertificateStatus.Revoked || cert.Status == CertificateStatus.Suspended)
        {
            return new CertificateVerificationResultDto
            {
                IsValid = false,
                Message = $"证书状态异常：{cert.Status}",
                CertificateNo = dto.CertificateNo,
                HolderName = dto.HolderName,
                ExpiryDate = cert.ExpiryDate,
                Status = cert.Status.ToString(),
                VerifiedAt = DateTime.UtcNow
            };
        }

        if (cert.ExpiryDate < DateTime.UtcNow)
        {
            return new CertificateVerificationResultDto
            {
                IsValid = false,
                Message = "证书已过期",
                CertificateNo = dto.CertificateNo,
                HolderName = dto.HolderName,
                ExpiryDate = cert.ExpiryDate,
                Status = "Expired",
                VerifiedAt = DateTime.UtcNow
            };
        }

        return new CertificateVerificationResultDto
        {
            IsValid = true,
            Message = "证书有效",
            CertificateNo = dto.CertificateNo,
            HolderName = dto.HolderName,
            ExpiryDate = cert.ExpiryDate,
            Status = cert.Status.ToString(),
            VerifiedAt = DateTime.UtcNow
        };
    }

    public async Task<bool> ValidateOperatorCertificateAsync(int operatorId, string certificateType, string? certificateNo = null)
    {
        var certType = Enum.TryParse<CertificateType>(certificateType, out var type) ? type : CertificateType.SpecialOperationCertificate;

        var query = _certRepo.GetQueryable()
            .Where(c => c.UserId == operatorId && c.Type == certType);

        if (!string.IsNullOrEmpty(certificateNo))
        {
            query = query.Where(c => c.CertificateNo == certificateNo);
        }

        var cert = await query.FirstOrDefaultAsync();

        if (cert == null)
        {
            return false;
        }

        if (cert.Status != CertificateStatus.Valid)
        {
            return false;
        }

        if (cert.ExpiryDate < DateTime.UtcNow)
        {
            return false;
        }

        return true;
    }

    public async Task<decimal> CalculateEnterpriseComplianceScoreAsync(int enterpriseId, int year, int month)
    {
        var startDate = new DateTime(year, month, 1);
        var endDate = startDate.AddMonths(1);

        decimal score = 100;

        var overdueHazards = await _hazardRepo.CountAsync(h =>
            h.Status == HazardRectificationStatus.Overdue &&
            h.CreatedAt >= startDate && h.CreatedAt < endDate &&
            (enterpriseId == 0 || h.EnterpriseId == enterpriseId));
        score -= overdueHazards * 10;

        var overdueDrills = await _drillRepo.CountAsync(d =>
            d.Status == DrillStatus.Overdue && d.Year == year &&
            (enterpriseId == 0 || d.EnterpriseId == enterpriseId));
        score -= overdueDrills * 5;

        var expiredCerts = await _certRepo.CountAsync(c =>
            c.Status == CertificateStatus.Expired &&
            (enterpriseId == 0 || c.EnterpriseId == enterpriseId));
        score -= expiredCerts * 8;

        var unqualifiedBatches = await _batchRepo.CountAsync(b =>
            b.InspectionPassed == false &&
            b.CreatedAt >= startDate && b.CreatedAt < endDate &&
            (enterpriseId == 0 || b.EnterpriseId == enterpriseId));
        score -= unqualifiedBatches * 3;

        var anomalyTransports = await _transportRepo.CountAsync(t =>
            (t.IsDeviating || t.IsOverspeeding) &&
            t.CreatedAt >= startDate && t.CreatedAt < endDate &&
            (enterpriseId == 0 || t.EnterpriseId == enterpriseId));
        score -= anomalyTransports * 2;

        return Math.Max(0, score);
    }

    public async Task<List<ComplianceReportDto>> GenerateBatchReportsAsync(int year, int month)
    {
        var enterprises = await _enterpriseRepo.GetListAsync(e => e.IsActive);
        var reports = new List<ComplianceReportDto>();

        foreach (var enterprise in enterprises)
        {
            var report = await GenerateMonthlyReportAsync(year, month, enterprise.Id);
            reports.Add(report);
        }

        var overallReport = await GenerateMonthlyReportAsync(year, month);
        overallReport.EnterpriseName = "全省汇总";
        reports.Insert(0, overallReport);

        return reports;
    }

    private static string GetComplianceLevel(decimal score)
    {
        return score switch
        {
            >= 90 => "优秀",
            >= 80 => "良好",
            >= 70 => "合格",
            >= 60 => "基本合格",
            _ => "不合格"
        };
    }
}
