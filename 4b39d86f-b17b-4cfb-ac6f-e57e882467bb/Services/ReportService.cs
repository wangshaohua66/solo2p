using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace HazChemSupervision.Services;

public class ReportService : IReportService
{
    private readonly IBaseRepository<ChemicalBatch> _batchRepo;
    private readonly IBaseRepository<TransportRecord> _transportRepo;
    private readonly IBaseRepository<Inventory> _inventoryRepo;
    private readonly IBaseRepository<HazardRectification> _hazardRepo;
    private readonly IBaseRepository<EmergencyDrill> _drillRepo;
    private readonly IBaseRepository<Certificate> _certRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IComplianceService _complianceService;
    private readonly IMapper _mapper;

    public ReportService(
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<TransportRecord> transportRepo,
        IBaseRepository<Inventory> inventoryRepo,
        IBaseRepository<HazardRectification> hazardRepo,
        IBaseRepository<EmergencyDrill> drillRepo,
        IBaseRepository<Certificate> certRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IComplianceService complianceService,
        IMapper mapper)
    {
        _batchRepo = batchRepo;
        _transportRepo = transportRepo;
        _inventoryRepo = inventoryRepo;
        _hazardRepo = hazardRepo;
        _drillRepo = drillRepo;
        _certRepo = certRepo;
        _enterpriseRepo = enterpriseRepo;
        _complianceService = complianceService;
        _mapper = mapper;
    }

    public async Task<ComplianceReportDto> GetComplianceReportAsync(ReportQueryDto dto)
    {
        return await _complianceService.GenerateMonthlyReportAsync(dto.Year, dto.Month, dto.EnterpriseId);
    }

    public async Task<byte[]> ExportComplianceReportAsync(ReportQueryDto dto)
    {
        var report = await _complianceService.GenerateMonthlyReportAsync(dto.Year, dto.Month, dto.EnterpriseId);

        var sb = new StringBuilder();
        sb.AppendLine("危化品监管合规报告");
        sb.AppendLine("=".PadRight(50, '='));
        sb.AppendLine($"报告编号: {report.ReportNo}");
        sb.AppendLine($"统计周期: {report.Year}年{report.Month}月");
        sb.AppendLine($"企业名称: {report.EnterpriseName ?? "全部企业"}");
        sb.AppendLine($"生成时间: {report.GeneratedAt:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine();
        sb.AppendLine("一、批次管理情况");
        sb.AppendLine($"- 总批次数量: {report.TotalBatches}");
        sb.AppendLine($"- 合格批次: {report.QualifiedBatches}");
        sb.AppendLine($"- 不合格批次: {report.UnqualifiedBatches}");
        sb.AppendLine();
        sb.AppendLine("二、运输管理情况");
        sb.AppendLine($"- 在途运输: {report.InTransitTransports}");
        sb.AppendLine($"- 已完成运输: {report.CompletedTransports}");
        sb.AppendLine($"- 异常运输: {report.AnomalyTransports}");
        sb.AppendLine();
        sb.AppendLine("三、库存管理情况");
        sb.AppendLine($"- 总库存量: {report.TotalInventory}");
        sb.AppendLine($"- 超储告警: {report.OverstockInventory}");
        sb.AppendLine($"- 低储告警: {report.LowStockInventory}");
        sb.AppendLine($"- 临期库存: {report.NearExpiryInventory}");
        sb.AppendLine();
        sb.AppendLine("四、隐患管理情况");
        sb.AppendLine($"- 隐患总数: {report.TotalHazards}");
        sb.AppendLine($"- 已闭环: {report.ClosedHazards}");
        sb.AppendLine($"- 逾期未改: {report.OverdueHazards}");
        sb.AppendLine();
        sb.AppendLine("五、演练管理情况");
        sb.AppendLine($"- 计划演练: {report.PlannedDrills}");
        sb.AppendLine($"- 已完成: {report.CompletedDrills}");
        sb.AppendLine($"- 逾期未执行: {report.OverdueDrills}");
        sb.AppendLine();
        sb.AppendLine("六、资质证书情况");
        sb.AppendLine($"- 有效证书: {report.ValidCertificates}");
        sb.AppendLine($"- 即将到期: {report.ExpiringCertificates}");
        sb.AppendLine($"- 已过期: {report.ExpiredCertificates}");
        sb.AppendLine();
        sb.AppendLine($"七、合规评分: {report.ComplianceScore:F2}分");
        sb.AppendLine($"合规等级: {report.ComplianceLevel}");
        sb.AppendLine();

        if (report.Issues?.Count > 0)
        {
            sb.AppendLine("八、存在问题");
            foreach (var issue in report.Issues)
            {
                sb.AppendLine($"- {issue}");
            }
            sb.AppendLine();
        }

        if (report.Recommendations?.Count > 0)
        {
            sb.AppendLine("九、整改建议");
            foreach (var recommendation in report.Recommendations)
            {
                sb.AppendLine($"- {recommendation}");
            }
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportInventoryReportAsync(int? enterpriseId = null, int? warehouseId = null, int? category = null)
    {
        var query = _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Warehouse)
            .Include(i => i.Chemical);

        if (enterpriseId.HasValue)
            query = query.Where(i => i.EnterpriseId == enterpriseId.Value);
        if (warehouseId.HasValue)
            query = query.Where(i => i.WarehouseId == warehouseId.Value);
        if (category.HasValue)
            query = query.Where(i => i.Chemical.Category == (ChemicalCategory)category.Value);

        var inventories = await query.OrderBy(i => i.Enterprise.Name).ThenBy(i => i.Warehouse.Name).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("库存统计报表");
        sb.AppendLine("=".PadRight(80, '='));
        sb.AppendLine($"生成时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine();
        sb.AppendLine($"企业\t仓库\t危化品\t类别\t当前库存\t单位\t状态\t告警状态");
        sb.AppendLine("-".PadRight(80, '-'));

        foreach (var inv in inventories)
        {
            var alertStatus = new List<string>();
            if (inv.HasOverstockAlert) alertStatus.Add("超储");
            if (inv.HasLowStockAlert) alertStatus.Add("低储");
            if (inv.Status == InventoryStatus.NearExpiry) alertStatus.Add("临期");
            if (inv.Status == InventoryStatus.Expired) alertStatus.Add("过期");

            sb.AppendLine($"{inv.Enterprise.Name}\t{inv.Warehouse.Name}\t{inv.Chemical.Name}\t{inv.Chemical.Category}\t{inv.Quantity:F2}\t{inv.Unit}\t{inv.Status}\t{string.Join(",", alertStatus)}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportTransportReportAsync(DateRangeFilter dateRange, int? enterpriseId = null)
    {
        var predicate = PredicateBuilder.True<TransportRecord>();

        if (enterpriseId.HasValue)
            predicate = predicate.And(t => t.EnterpriseId == enterpriseId.Value);

        if (dateRange?.StartDate.HasValue)
            predicate = predicate.And(t => t.PlannedDepartureTime >= dateRange.StartDate.Value);
        if (dateRange?.EndDate.HasValue)
            predicate = predicate.And(t => t.PlannedDepartureTime < dateRange.EndDate.Value.AddDays(1));

        var transports = await _transportRepo.GetQueryable()
            .Include(t => t.Enterprise)
            .Include(t => t.ChemicalBatch)
                .ThenInclude(b => b.Chemical)
            .Where(predicate)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("运输记录报表");
        sb.AppendLine("=".PadRight(100, '='));
        sb.AppendLine($"生成时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine();
        sb.AppendLine($"运输单号\t企业\t危化品\t车牌\t司机\t状态\t起运时间\t到达时间\t异常状态");
        sb.AppendLine("-".PadRight(100, '-'));

        foreach (var t in transports)
        {
            var anomalies = new List<string>();
            if (t.IsDeviating) anomalies.Add("偏离路线");
            if (t.IsOverspeeding) anomalies.Add("超速");
            if (t.IsTemperatureAbnormal) anomalies.Add("温度异常");

            sb.AppendLine($"{t.TransportNo}\t{t.Enterprise.Name}\t{t.ChemicalBatch.Chemical.Name}\t{t.VehiclePlateNo}\t{t.DriverName}\t{t.Status}\t{t.ActualDepartureTime:yyyy-MM-dd}\t{t.ActualArrivalTime:yyyy-MM-dd}\t{string.Join(",", anomalies)}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportHazardReportAsync(int? enterpriseId = null, int? status = null)
    {
        var predicate = PredicateBuilder.True<HazardRectification>();

        if (enterpriseId.HasValue)
            predicate = predicate.And(h => h.EnterpriseId == enterpriseId.Value);

        if (status.HasValue)
            predicate = predicate.And(h => h.Status == (HazardRectificationStatus)status.Value);

        var hazards = await _hazardRepo.GetQueryable()
            .Include(h => h.Enterprise)
            .Where(predicate)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("隐患整改报表");
        sb.AppendLine("=".PadRight(100, '='));
        sb.AppendLine($"生成时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine();
        sb.AppendLine($"工单号\t企业\t隐患描述\t等级\t状态\t责任人\t发现时间\t整改期限\t逾期天数");
        sb.AppendLine("-".PadRight(100, '-'));

        var now = DateTime.UtcNow;
        foreach (var h in hazards)
        {
            var overdueDays = h.Deadline < now && h.Status != HazardRectificationStatus.Accepted && h.Status != HazardRectificationStatus.Closed
                ? (int)(now - h.Deadline).TotalDays : 0;

            sb.AppendLine($"{h.WorkOrderNo}\t{h.Enterprise.Name}\t{h.HazardDescription}\t{h.Level}\t{h.Status}\t{h.ResponsiblePerson}\t{h.DiscoveryTime:yyyy-MM-dd}\t{h.Deadline:yyyy-MM-dd}\t{overdueDays}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<byte[]> ExportDrillReportAsync(int year, int? quarter = null, int? enterpriseId = null)
    {
        var predicate = PredicateBuilder.True<EmergencyDrill>()
            .And(d => d.Year == year);

        if (quarter.HasValue)
            predicate = predicate.And(d => d.Quarter == quarter.Value);

        if (enterpriseId.HasValue)
            predicate = predicate.And(d => d.EnterpriseId == enterpriseId.Value);

        var drills = await _drillRepo.GetQueryable()
            .Include(d => d.Enterprise)
            .Where(predicate)
            .OrderBy(d => d.PlannedStartTime)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("应急演练报表");
        sb.AppendLine("=".PadRight(100, '='));
        sb.AppendLine($"统计年度: {year}年");
        sb.AppendLine($"生成时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine();
        sb.AppendLine($"计划编号\t演练名称\t企业\t类型\t状态\t计划时间\t实际时间\t评估结果");
        sb.AppendLine("-".PadRight(100, '-'));

        foreach (var d in drills)
        {
            sb.AppendLine($"{d.PlanNo}\t{d.Name}\t{d.Enterprise.Name}\t{d.Type}\t{d.Status}\t{d.PlannedStartTime:yyyy-MM-dd}\t{d.ActualStartTime:yyyy-MM-dd}\t{d.EvaluationResult}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
