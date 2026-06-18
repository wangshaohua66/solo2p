using AutoMapper;
using ClosedXML.Excel;
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

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("合规报告");

        worksheet.Cell("A1").Value = "危化品监管合规报告（国标格式）";
        worksheet.Range("A1:E1").Merge();
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 16;
        worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        worksheet.Cell("A3").Value = "报告编号：";
        worksheet.Cell("B3").Value = report.ReportNo;
        worksheet.Cell("D3").Value = "统计周期：";
        worksheet.Cell("E3").Value = $"{report.Year}年{report.Month}月";

        worksheet.Cell("A4").Value = "企业名称：";
        worksheet.Cell("B4").Value = report.EnterpriseName ?? "全部企业";
        worksheet.Cell("D4").Value = "生成时间：";
        worksheet.Cell("E4").Value = report.GeneratedAt.ToString("yyyy-MM-dd HH:mm:ss");

        worksheet.Cell("A6").Value = "序号";
        worksheet.Cell("B6").Value = "统计项目";
        worksheet.Cell("C6").Value = "数量";
        worksheet.Cell("D6").Value = "单位";
        worksheet.Cell("E6").Value = "备注";
        worksheet.Range("A6:E6").Style.Fill.BackgroundColor = XLColor.LightGray;
        worksheet.Range("A6:E6").Style.Font.Bold = true;

        var data = new (string Item, int Count, string Unit, string Remark)[]
        {
            ("一、批次管理", 0, "", ""),
            ("总批次数量", report.TotalBatches, "批", ""),
            ("合格批次", report.QualifiedBatches, "批", ""),
            ("不合格批次", report.UnqualifiedBatches, "批", ""),
            ("二、运输管理", 0, "", ""),
            ("在途运输", report.InTransitTransports, "次", ""),
            ("已完成运输", report.CompletedTransports, "次", ""),
            ("异常运输", report.AnomalyTransports, "次", ""),
            ("三、库存管理", 0, "", ""),
            ("总库存量", report.TotalInventory, "吨/立方米", ""),
            ("超储告警", report.OverstockInventory, "项", ""),
            ("低储告警", report.LowStockInventory, "项", ""),
            ("临期库存", report.NearExpiryInventory, "项", ""),
            ("四、隐患管理", 0, "", ""),
            ("隐患总数", report.TotalHazards, "项", ""),
            ("已闭环", report.ClosedHazards, "项", ""),
            ("逾期未改", report.OverdueHazards, "项", ""),
            ("五、演练管理", 0, "", ""),
            ("计划演练", report.PlannedDrills, "次", ""),
            ("已完成", report.CompletedDrills, "次", ""),
            ("逾期未执行", report.OverdueDrills, "次", ""),
            ("六、资质证书", 0, "", ""),
            ("有效证书", report.ValidCertificates, "本", ""),
            ("即将到期", report.ExpiringCertificates, "本", ""),
            ("已过期", report.ExpiredCertificates, "本", ""),
        };

        int row = 7;
        int seq = 1;
        foreach (var item in data)
        {
            if (item.Item.StartsWith("一、") || item.Item.StartsWith("二、") ||
                item.Item.StartsWith("三、") || item.Item.StartsWith("四、") ||
                item.Item.StartsWith("五、") || item.Item.StartsWith("六、"))
            {
                worksheet.Cell($"A{row}").Value = item.Item;
                worksheet.Range($"A{row}:E{row}").Merge();
                worksheet.Range($"A{row}:E{row}").Style.Fill.BackgroundColor = XLColor.LightBlue;
                worksheet.Range($"A{row}:E{row}").Style.Font.Bold = true;
                seq = 1;
            }
            else
            {
                worksheet.Cell($"A{row}").Value = seq++;
                worksheet.Cell($"B{row}").Value = item.Item;
                worksheet.Cell($"C{row}").Value = item.Count;
                worksheet.Cell($"D{row}").Value = item.Unit;
                worksheet.Cell($"E{row}").Value = item.Remark;
            }
            row++;
        }

        worksheet.Cell($"A{row}").Value = $"七、合规评分：{report.ComplianceScore:F2}分";
        worksheet.Cell($"A{row}").Style.Font.Bold = true;
        worksheet.Range($"A{row}:E{row}").Merge();
        row++;
        worksheet.Cell($"A{row}").Value = $"合规等级：{report.ComplianceLevel}";
        worksheet.Range($"A{row}:E{row}").Merge();
        row += 2;

        if (report.Issues?.Count > 0)
        {
            worksheet.Cell($"A{row}").Value = "八、存在问题";
            worksheet.Cell($"A{row}").Style.Font.Bold = true;
            worksheet.Range($"A{row}:E{row}").Merge();
            row++;
            foreach (var issue in report.Issues)
            {
                worksheet.Cell($"A{row}").Value = $"• {issue}";
                worksheet.Range($"A{row}:E{row}").Merge();
                row++;
            }
            row++;
        }

        if (report.Recommendations?.Count > 0)
        {
            worksheet.Cell($"A{row}").Value = "九、整改建议";
            worksheet.Cell($"A{row}").Style.Font.Bold = true;
            worksheet.Range($"A{row}:E{row}").Merge();
            row++;
            foreach (var rec in report.Recommendations)
            {
                worksheet.Cell($"A{row}").Value = $"• {rec}";
                worksheet.Range($"A{row}:E{row}").Merge();
                row++;
            }
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
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

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("库存统计报表");

        worksheet.Cell("A1").Value = "危化品库存统计报表（国标GB 18265-2019）";
        worksheet.Range("A1:J1").Merge();
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 14;
        worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        worksheet.Cell("A3").Value = "生成时间：";
        worksheet.Cell("B3").Value = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        string[] headers = { "序号", "企业名称", "仓库名称", "危化品名称", "危化品类别", "CAS号", "当前库存", "单位", "库存状态", "告警状态" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(5, i + 1).Value = headers[i];
            worksheet.Cell(5, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
            worksheet.Cell(5, i + 1).Style.Font.Bold = true;
        }

        int row = 6;
        int seq = 1;
        foreach (var inv in inventories)
        {
            var alertStatus = new List<string>();
            if (inv.HasOverstockAlert) alertStatus.Add("超储");
            if (inv.HasLowStockAlert) alertStatus.Add("低储");
            if (inv.Status == InventoryStatus.NearExpiry) alertStatus.Add("临期");
            if (inv.Status == InventoryStatus.Expired) alertStatus.Add("过期");

            worksheet.Cell(row, 1).Value = seq++;
            worksheet.Cell(row, 2).Value = inv.Enterprise.Name;
            worksheet.Cell(row, 3).Value = inv.Warehouse.Name;
            worksheet.Cell(row, 4).Value = inv.Chemical.Name;
            worksheet.Cell(row, 5).Value = inv.Chemical.Category.ToString();
            worksheet.Cell(row, 6).Value = inv.Chemical.CasNo;
            worksheet.Cell(row, 7).Value = (double)inv.Quantity;
            worksheet.Cell(row, 8).Value = inv.Unit;
            worksheet.Cell(row, 9).Value = inv.Status.ToString();
            worksheet.Cell(row, 10).Value = string.Join(",", alertStatus);
            row++;
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
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

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("运输记录报表");

        worksheet.Cell("A1").Value = "危险化学品运输记录报表（国标JT/T 617-2018）";
        worksheet.Range("A1:K1").Merge();
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 14;
        worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        worksheet.Cell("A3").Value = "生成时间：";
        worksheet.Cell("B3").Value = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        string[] headers = { "序号", "运输单号", "企业名称", "危化品名称", "车牌号", "驾驶员", "押运员", "运输状态", "起运时间", "到达时间", "异常状态" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(5, i + 1).Value = headers[i];
            worksheet.Cell(5, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
            worksheet.Cell(5, i + 1).Style.Font.Bold = true;
        }

        int row = 6;
        int seq = 1;
        foreach (var t in transports)
        {
            var anomalies = new List<string>();
            if (t.IsDeviating) anomalies.Add("偏离路线");
            if (t.IsOverspeeding) anomalies.Add("超速");
            if (t.IsTemperatureAbnormal) anomalies.Add("温度异常");

            worksheet.Cell(row, 1).Value = seq++;
            worksheet.Cell(row, 2).Value = t.TransportNo;
            worksheet.Cell(row, 3).Value = t.Enterprise.Name;
            worksheet.Cell(row, 4).Value = t.ChemicalBatch.Chemical.Name;
            worksheet.Cell(row, 5).Value = t.VehiclePlateNo;
            worksheet.Cell(row, 6).Value = t.DriverName;
            worksheet.Cell(row, 7).Value = t.EscortName ?? "";
            worksheet.Cell(row, 8).Value = t.Status.ToString();
            worksheet.Cell(row, 9).Value = t.ActualDepartureTime?.ToString("yyyy-MM-dd HH:mm") ?? "";
            worksheet.Cell(row, 10).Value = t.ActualArrivalTime?.ToString("yyyy-MM-dd HH:mm") ?? "";
            worksheet.Cell(row, 11).Value = string.Join(",", anomalies);
            row++;
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
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

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("隐患整改报表");

        worksheet.Cell("A1").Value = "安全生产隐患排查治理报表（国标AQ/T 9005-2018）";
        worksheet.Range("A1:K1").Merge();
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 14;
        worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        worksheet.Cell("A3").Value = "生成时间：";
        worksheet.Cell("B3").Value = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        string[] headers = { "序号", "工单号", "企业名称", "隐患描述", "隐患等级", "整改状态", "责任人", "发现时间", "整改期限", "逾期天数", "是否升级" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(5, i + 1).Value = headers[i];
            worksheet.Cell(5, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
            worksheet.Cell(5, i + 1).Style.Font.Bold = true;
        }

        int row = 6;
        int seq = 1;
        var now = DateTime.UtcNow;
        foreach (var h in hazards)
        {
            var overdueDays = h.Deadline < now && h.Status != HazardRectificationStatus.Accepted && h.Status != HazardRectificationStatus.Closed
                ? (int)(now - h.Deadline).TotalDays : 0;

            worksheet.Cell(row, 1).Value = seq++;
            worksheet.Cell(row, 2).Value = h.WorkOrderNo;
            worksheet.Cell(row, 3).Value = h.Enterprise.Name;
            worksheet.Cell(row, 4).Value = h.HazardDescription;
            worksheet.Cell(row, 5).Value = h.Level.ToString();
            worksheet.Cell(row, 6).Value = h.Status.ToString();
            worksheet.Cell(row, 7).Value = h.ResponsiblePerson;
            worksheet.Cell(row, 8).Value = h.DiscoveryTime.ToString("yyyy-MM-dd");
            worksheet.Cell(row, 9).Value = h.Deadline.ToString("yyyy-MM-dd");
            worksheet.Cell(row, 10).Value = overdueDays;
            worksheet.Cell(row, 11).Value = h.IsEscalated ? "是" : "否";
            row++;
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
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

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("应急演练报表");

        worksheet.Cell("A1").Value = "生产安全事故应急演练报表（国标GB/T 29639-2020）";
        worksheet.Range("A1:J1").Merge();
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 14;
        worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        worksheet.Cell("A3").Value = "统计年度：";
        worksheet.Cell("B3").Value = $"{year}年";
        worksheet.Cell("D3").Value = "生成时间：";
        worksheet.Cell("E3").Value = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        string[] headers = { "序号", "计划编号", "演练名称", "企业名称", "演练类型", "演练状态", "计划时间", "实际时间", "参演人数", "评估结果" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(5, i + 1).Value = headers[i];
            worksheet.Cell(5, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
            worksheet.Cell(5, i + 1).Style.Font.Bold = true;
        }

        int row = 6;
        int seq = 1;
        foreach (var d in drills)
        {
            worksheet.Cell(row, 1).Value = seq++;
            worksheet.Cell(row, 2).Value = d.PlanNo;
            worksheet.Cell(row, 3).Value = d.Name;
            worksheet.Cell(row, 4).Value = d.Enterprise.Name;
            worksheet.Cell(row, 5).Value = d.Type.ToString();
            worksheet.Cell(row, 6).Value = d.Status.ToString();
            worksheet.Cell(row, 7).Value = d.PlannedStartTime.ToString("yyyy-MM-dd");
            worksheet.Cell(row, 8).Value = d.ActualStartTime?.ToString("yyyy-MM-dd") ?? "";
            worksheet.Cell(row, 9).Value = d.ParticipantCount;
            worksheet.Cell(row, 10).Value = d.EvaluationResult?.ToString() ?? "";
            row++;
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
