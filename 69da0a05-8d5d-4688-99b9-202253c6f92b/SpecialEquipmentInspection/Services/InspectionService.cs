using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace SpecialEquipmentInspection.Services;

public class InspectionOptions
{
    public int MaxPhotosPerInspection { get; set; } = 20;
    public int MaxPhotoSizeMB { get; set; } = 5;
    public int MaxVideosPerInspection { get; set; } = 5;
    public int MaxVideoSizeMB { get; set; } = 50;
    public int RectificationDefaultDays { get; set; } = 15;
    public int WarningBeforeExpiryDays { get; set; } = 30;
    public int ReportRetentionYears { get; set; } = 10;
}

public class InspectionService : IInspectionService
{
    private static readonly JsonSerializerOptions ReportJsonOptions = new()
    {
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IDeviceRepository _devices;
    private readonly IInspectionRepository _inspections;
    private readonly IInspectorRepository _inspectors;
    private readonly InspectionOptions _options;
    private readonly SupervisionPlatformOptions _supervisionOptions;
    private readonly ILogger<InspectionService> _logger;
    private readonly ISupervisionPlatformClient _supervisionClient;

    public InspectionService(
        IDeviceRepository devices,
        IInspectionRepository inspections,
        IInspectorRepository inspectors,
        IOptions<InspectionOptions> options,
        IOptions<SupervisionPlatformOptions> supervisionOptions,
        ILogger<InspectionService> logger,
        ISupervisionPlatformClient supervisionClient)
    {
        _devices = devices;
        _inspections = inspections;
        _inspectors = inspectors;
        _options = options.Value;
        _supervisionOptions = supervisionOptions.Value;
        _logger = logger;
        _supervisionClient = supervisionClient;
    }

    public async Task<InspectionPlan> CreatePlanAsync(CreatePlanDto dto, CurrentUser user)
    {
        if (!user.IsAdmin) throw new ForbiddenException("仅管理员可生成检验计划");

        var inspector = await _inspectors.GetByIdAsync(dto.InspectorId ?? 0);
        if (dto.InspectorId.HasValue && inspector == null)
            throw new NotFoundException("检验员不存在");

        List<Device> targets;
        if (dto.DeviceIds.Count > 0)
        {
            targets = new List<Device>();
            foreach (var id in dto.DeviceIds)
            {
                var d = await _devices.GetByIdAsync(id);
                if (d != null) targets.Add(d);
            }
        }
        else
        {
            targets = await _devices.GetDevicesDueForInspectionAsync(dto.Year);
            if (!string.IsNullOrWhiteSpace(dto.Region)) targets = targets.Where(d => d.Region == dto.Region).ToList();
            if (dto.DeviceType.HasValue) targets = targets.Where(d => d.Type == dto.DeviceType.Value).ToList();
        }

        var plan = new InspectionPlan
        {
            PlanCode = $"PL-{dto.Year}-{DateTime.Now:MMddHHmmssfff}",
            Year = dto.Year,
            Region = dto.Region ?? "全部",
            DeviceType = dto.DeviceType,
            InspectorId = dto.InspectorId,
            InspectorName = inspector?.Name ?? "待分配",
            DeviceCount = targets.Count,
            Status = PlanStatus.Published
        };
        plan = await _inspections.AddPlanAsync(plan);

        var sequence = 0;
        foreach (var device in targets)
        {
            sequence++;
            if (dto.InspectorId.HasValue && !await _inspectors.CanInspectTypeAsync(dto.InspectorId.Value, device.Type))
            {
                _logger.LogWarning("检验员{InspectorId}无资质检验设备类型{Type}，设备{DeviceId}跳过", dto.InspectorId, device.Type, device.Id);
                continue;
            }

            var inspection = new Inspection
            {
                InspectionCode = $"INS-{DateTime.Now:yyyyMMddHHmmssfff}-{sequence:D4}",
                PlanId = plan.Id,
                DeviceId = device.Id,
                DeviceCode = device.DeviceCode,
                DeviceName = device.Name,
                DeviceType = device.Type,
                InspectorId = dto.InspectorId ?? 0,
                InspectorName = inspector?.Name ?? "待分配",
                ScheduledDate = device.NextInspectionDate,
                Status = InspectionStatus.Scheduled,
                Result = InspectionResult.Pass
            };
            await _inspections.AddInspectionAsync(inspection);
            await _devices.UpdateStatusAsync(device.Id, DeviceStatus.PendingInspection);
        }

        return plan;
    }

    public Task<InspectionPlan?> GetPlanAsync(int id) => _inspections.GetPlanAsync(id);

    public Task<PagedResult<InspectionPlan>> GetPlansAsync(int? year, string? region, PlanStatus? status, int page, int pageSize)
        => _inspections.GetPlansPagedAsync(year, region, status, page, pageSize);

    public async Task<Inspection> CreateInspectionAsync(CreateInspectionDto dto, CurrentUser user)
    {
        if (!user.IsAdmin) throw new ForbiddenException("仅管理员可创建检验任务");

        var device = await _devices.GetByIdAsync(dto.DeviceId)
            ?? throw new NotFoundException("设备不存在");

        if (!await _inspectors.CanInspectTypeAsync(dto.InspectorId, device.Type))
            throw new BusinessException("该检验员无该设备类型的检验资质或资质已过期");

        var inspector = await _inspectors.GetByIdAsync(dto.InspectorId);

        var inspection = new Inspection
        {
            InspectionCode = $"INS-{DateTime.Now:yyyyMMddHHmmssfff}",
            PlanId = dto.PlanId,
            DeviceId = device.Id,
            DeviceCode = device.DeviceCode,
            DeviceName = device.Name,
            DeviceType = device.Type,
            InspectorId = dto.InspectorId,
            InspectorName = inspector?.Name ?? string.Empty,
            ScheduledDate = dto.ScheduledDate,
            Status = InspectionStatus.Scheduled,
            Result = InspectionResult.Pass
        };
        inspection = await _inspections.AddInspectionAsync(inspection);
        await _devices.UpdateStatusAsync(device.Id, DeviceStatus.PendingInspection);
        return inspection;
    }

    public async Task<Inspection?> GetInspectionAsync(int id, CurrentUser user)
    {
        var inspection = await _inspections.GetInspectionByIdAsync(id)
            ?? throw new NotFoundException("检验任务不存在");

        EnsureCanAccessInspection(inspection, user);
        return inspection;
    }

    public async Task<PagedResult<Inspection>> GetInspectionsAsync(
        int? deviceId, int? inspectorId, InspectionStatus? status, InspectionResult? result,
        int? planId, DateTime? dateFrom, DateTime? dateTo, int page, int pageSize, CurrentUser user)
    {
        string? useUnitCode = null;
        if (user.IsUserUnit) useUnitCode = user.UseUnitCode;
        if (user.IsInspector) inspectorId = user.InspectorId ?? inspectorId;

        return await _inspections.GetInspectionsPagedAsync(
            deviceId, inspectorId, status, result, planId, useUnitCode, dateFrom, dateTo, page, pageSize);
    }

    public async Task<Inspection> StartInspectionAsync(int inspectionId, CurrentUser user)
    {
        var inspection = await _inspections.GetInspectionByIdAsync(inspectionId)
            ?? throw new NotFoundException("检验任务不存在");
        EnsureCanAccessInspection(inspection, user);

        if (inspection.Status != InspectionStatus.Scheduled)
            throw new BusinessException("仅已排期的检验任务可开始执行");

        inspection.Status = InspectionStatus.InProgress;
        inspection.InspectionDate = DateTime.Now;
        await _inspections.UpdateInspectionAsync(inspection);
        await _devices.UpdateStatusAsync(inspection.DeviceId, DeviceStatus.UnderInspection);
        return inspection;
    }

    public async Task<Inspection> SubmitInspectionAsync(int inspectionId, SubmitInspectionDto dto, CurrentUser user)
    {
        var inspection = await _inspections.GetInspectionByIdAsync(inspectionId)
            ?? throw new NotFoundException("检验任务不存在");
        EnsureCanAccessInspection(inspection, user);

        if (inspection.Status == InspectionStatus.Completed || inspection.Status == InspectionStatus.Approved)
            throw new BusinessException("该检验任务已完成，不可重复提交");

        if (dto.Photos.Count > _options.MaxPhotosPerInspection)
            throw new BusinessException($"每次检验照片不能超过{_options.MaxPhotosPerInspection}张");

        if (dto.Videos.Count > _options.MaxVideosPerInspection)
            throw new BusinessException($"每次检验视频不能超过{_options.MaxVideosPerInspection}个");

        var isHighRisk = inspection.DeviceType == DeviceType.PassengerRopeway || inspection.DeviceType == DeviceType.LargeAmusementDevice;
        if (isHighRisk && dto.Videos.Count == 0)
            throw new BusinessException("客运索道、大型游乐设施等高风险设备必须采集现场运行视频");

        var device = await _devices.GetByIdAsync(inspection.DeviceId);

        inspection.Status = InspectionStatus.Completed;
        inspection.Result = dto.Result;
        inspection.Conclusion = dto.Conclusion;
        inspection.InspectionDate ??= DateTime.Now;
        inspection.Photos = JsonSerializer.Serialize(dto.Photos);
        inspection.Videos = JsonSerializer.Serialize(dto.Videos);
        inspection.Findings = dto.Findings;
        inspection.NextInspectionDate = dto.NextInspectionDate ?? CalculateNextInspectionDate(inspection.DeviceType, inspection.InspectionDate.Value, device?.ManufacturingDate);
        await _inspections.UpdateInspectionAsync(inspection);

        var items = dto.Items.Select(i => new InspectionItem
        {
            InspectionId = inspectionId,
            ItemCode = i.ItemCode,
            ItemName = i.ItemName,
            Standard = i.Standard,
            Result = i.Result,
            Data = i.Data,
            Description = i.Description,
            CreatedAt = DateTime.Now
        }).ToList();
        await _inspections.ReplaceItemsAsync(inspectionId, items);

        if (device != null)
        {
            device.LastInspectionDate = inspection.InspectionDate;
            device.NextInspectionDate = inspection.NextInspectionDate ?? device.NextInspectionDate;
            device.Status = dto.Result == InspectionResult.Suspended ? DeviceStatus.Suspended
                          : dto.Result == InspectionResult.Fail ? DeviceStatus.PendingInspection
                          : DeviceStatus.Normal;
            device.UpdatedAt = DateTime.Now;
            await _devices.UpdateAsync(device);
        }

        foreach (var failItem in items.Where(i => i.Result == InspectionResult.Fail))
        {
            await CreateRectificationInternalAsync(inspection, device, failItem);
        }

        await GenerateReportAsync(inspectionId, user);
        return inspection;
    }

    public async Task<Rectification> CreateRectificationAsync(RectificationCreateDto dto, CurrentUser user)
    {
        var item = await _inspections.GetItemAsync(dto.InspectionItemId)
            ?? throw new NotFoundException("检验项目不存在");
        var inspection = await _inspections.GetInspectionByIdAsync(item.InspectionId)
            ?? throw new NotFoundException("检验任务不存在");
        EnsureCanAccessInspection(inspection, user);
        var device = await _devices.GetByIdAsync(inspection.DeviceId);
        return await CreateRectificationInternalAsync(inspection, device, item);
    }

    private async Task<Rectification> CreateRectificationInternalAsync(Inspection inspection, Device? device, InspectionItem item)
    {
        var now = DateTime.Now;
        var rect = new Rectification
        {
            InspectionItemId = item.Id,
            InspectionId = inspection.Id,
            DeviceId = inspection.DeviceId,
            UseUnitCode = device?.UseUnitCode ?? string.Empty,
            UseUnitName = device?.UseUnitName ?? string.Empty,
            Description = $"检验项目【{item.ItemName}】不合格，需整改：{(string.IsNullOrWhiteSpace(item.Description) ? "无" : item.Description)}",
            NotifyDate = now,
            Deadline = now.AddDays(_options.RectificationDefaultDays),
            Status = RectificationStatus.Pending,
            WarningLevel = 0
        };
        return await _inspections.AddRectificationAsync(rect);
    }

    public async Task<Rectification> SubmitRectificationFeedbackAsync(int rectificationId, RectificationFeedbackDto dto, CurrentUser user)
    {
        var rect = await _inspections.GetRectificationAsync(rectificationId)
            ?? throw new NotFoundException("整改记录不存在");

        if (user.IsUserUnit && rect.UseUnitCode != user.UseUnitCode)
            throw new ForbiddenException("仅可对本单位整改记录提交反馈");

        if (rect.Status == RectificationStatus.Completed || rect.Status == RectificationStatus.Rejected)
            throw new BusinessException("该整改记录已结束，不可再次提交反馈");

        rect.RectificationResult = dto.RectificationResult;
        rect.CompleteDate = dto.CompleteDate ?? DateTime.Now;
        rect.Status = RectificationStatus.InProgress;
        await _inspections.UpdateRectificationAsync(rect);
        return rect;
    }

    public async Task<Rectification> ConfirmReinspectionAsync(int rectificationId, ReinspectionDto dto, CurrentUser user)
    {
        var rect = await _inspections.GetRectificationAsync(rectificationId)
            ?? throw new NotFoundException("整改记录不存在");

        if (!user.IsInspector && !user.IsAdmin)
            throw new ForbiddenException("仅检验员可进行复检确认");

        if (rect.Status != RectificationStatus.InProgress)
            throw new BusinessException("仅待复检状态的整改记录可进行复检确认");

        var item = await _inspections.GetItemAsync(rect.InspectionItemId);
        if (item != null)
        {
            item.Result = dto.ItemResult;
            item.Data = dto.Data;
            await _inspections.UpdateItemAsync(item);
        }

        if (dto.ItemResult == InspectionResult.Pass)
        {
            rect.Status = RectificationStatus.Completed;
            await _inspections.UpdateRectificationAsync(rect);

            var inspection = await _inspections.GetInspectionByIdAsync(rect.InspectionId);
            if (inspection != null && inspection.Result == InspectionResult.Fail)
            {
                var allRects = await _inspections.GetRectificationsPagedAsync(inspectionId: inspection.Id);
                if (allRects.Items.All(r => r.Status == RectificationStatus.Completed))
                {
                    inspection.Result = InspectionResult.PassAfterRectification;
                    await _inspections.UpdateInspectionAsync(inspection);
                }
            }
        }
        else
        {
            rect.Status = RectificationStatus.Rejected;
        }
        await _inspections.UpdateRectificationAsync(rect);
        return rect;
    }

    public async Task<PagedResult<Rectification>> GetRectificationsAsync(
        int? inspectionId, int? deviceId, RectificationStatus? status, int page, int pageSize, CurrentUser user)
    {
        string? useUnitCode = null;
        if (user.IsUserUnit) useUnitCode = user.UseUnitCode;
        return await _inspections.GetRectificationsPagedAsync(inspectionId, deviceId, useUnitCode, status, page, pageSize);
    }

    public async Task<Report> GenerateReportAsync(int inspectionId, CurrentUser user)
    {
        var inspection = await _inspections.GetInspectionByIdAsync(inspectionId)
            ?? throw new NotFoundException("检验任务不存在");
        EnsureCanAccessInspection(inspection, user);

        if (inspection.Status != InspectionStatus.Completed && inspection.Status != InspectionStatus.Approved)
            throw new BusinessException("仅已完成的检验可生成报告");

        var existing = await _inspections.GetReportByInspectionAsync(inspectionId);
        if (existing != null) return existing;

        var device = await _devices.GetByIdAsync(inspection.DeviceId);
        var deviceInfo = device == null ? "{}" : JsonSerializer.Serialize(device, ReportJsonOptions);
        var itemsSummary = JsonSerializer.Serialize(inspection.Items, ReportJsonOptions);

        var report = new Report
        {
            InspectionId = inspectionId,
            ReportNo = $"RPT-{DateTime.Now:yyyyMMddHHmmssfff}",
            DeviceInfo = deviceInfo,
            InspectionBasis = GetInspectionBasis(inspection.DeviceType),
            ItemsSummary = itemsSummary,
            Conclusion = inspection.Result,
            NextInspectionDate = inspection.NextInspectionDate,
            GeneratedDate = DateTime.Now,
            Status = ReportStatus.Draft
        };
        report = await _inspections.AddReportAsync(report);

        inspection.ReportId = report.Id;
        await _inspections.UpdateInspectionAsync(inspection);
        return report;
    }

    public Task<Report?> GetReportAsync(int reportId) => _inspections.GetReportAsync(reportId);
    public Task<Report?> GetReportByInspectionAsync(int inspectionId) => _inspections.GetReportByInspectionAsync(inspectionId);
    public Task<PagedResult<Report>> GetReportsAsync(ReportStatus? status, int page, int pageSize)
        => _inspections.GetReportsPagedAsync(status, page, pageSize);

    public async Task<Report> ApproveReportAsync(int reportId, ApproveReportDto dto, CurrentUser user)
    {
        if (!user.IsAdmin) throw new ForbiddenException("仅管理员可审批报告");

        var report = await _inspections.GetReportAsync(reportId)
            ?? throw new NotFoundException("报告不存在");

        if (report.Status == ReportStatus.Approved) throw new BusinessException("报告已审批通过");

        if (dto.Action == 1)
        {
            report.Status = ReportStatus.Approved;
            report.ApprovedBy = user.RealName;
            report.ApprovedDate = DateTime.Now;
            report.SealedPdfPath = $"seal://{report.ReportNo}";
            var inspection = await _inspections.GetInspectionByIdAsync(report.InspectionId);
            if (inspection != null)
            {
                inspection.Status = InspectionStatus.Approved;
                await _inspections.UpdateInspectionAsync(inspection);
            }
        }
        else
        {
            report.Status = ReportStatus.Rejected;
            report.Remark = dto.Remark;
        }
        await _inspections.UpdateReportAsync(report);
        return report;
    }

    public async Task<(byte[] Content, string FileName, string MimeType)> ExportReportAsync(int reportId, string format = "html")
    {
        var report = await _inspections.GetReportAsync(reportId)
            ?? throw new NotFoundException("报告不存在");
        var inspection = await _inspections.GetInspectionByIdAsync(report.InspectionId);

        var ext = format.ToLowerInvariant() switch
        {
            "pdf" => "pdf",
            _ => "html"
        };

        if (ext == "pdf")
        {
            var pdfBytes = BuildReportPdf(report, inspection);
            return (pdfBytes, $"{report.ReportNo}.pdf", "application/pdf");
        }
        else
        {
            var html = BuildReportHtml(report, inspection);
            var bytes = System.Text.Encoding.UTF8.GetBytes(html);
            return (bytes, $"{report.ReportNo}.html", "text/html; charset=utf-8");
        }
    }

    public Task<InspectionStatistics> GetStatisticsAsync(int? year, string? region)
        => _inspections.GetStatisticsAsync(year, region);

    public Task<TimeSeriesStatistics> GetTimeSeriesStatisticsAsync(
        DateTime dateFrom, DateTime dateTo, TimeDimension dimension, string? region, DeviceType? deviceType)
        => _inspections.GetTimeSeriesStatisticsAsync(dateFrom, dateTo, dimension, region, deviceType);

    public async Task<List<SupervisionReport>> GenerateSupervisionReportsAsync(bool fullSync, CurrentUser user)
    {
        if (!user.IsAdmin) throw new ForbiddenException("仅管理员可生成监察上报数据");

        var result = new List<SupervisionReport>();
        if (fullSync)
        {
            var paged = await _inspections.GetInspectionsPagedAsync(status: InspectionStatus.Approved, page: 1, pageSize: 1000);
            foreach (var ins in paged.Items)
            {
                result.Add(await BuildSupervisionReportAsync(ins, "全量同步"));
            }
        }
        else
        {
            var pending = await _inspections.GetOverdueRectificationsAsync();
            foreach (var rect in pending)
            {
                var ins = await _inspections.GetInspectionByIdAsync(rect.InspectionId);
                if (ins == null) continue;
                var sr = new SupervisionReport
                {
                    ReportCode = $"SUP-{DateTime.Now:yyyyMMddHHmmssfff}-{rect.Id}",
                    RectificationId = rect.Id,
                    InspectionId = rect.InspectionId,
                    DeviceId = rect.DeviceId,
                    DeviceCode = ins.DeviceCode,
                    ReportType = "整改超期上报",
                    Payload = JsonSerializer.Serialize(new
                    {
                        rect.Description,
                        rect.Deadline,
                        rect.Status,
                        rect.WarningLevel,
                        rect.UseUnitName
                    }),
                    Status = SupervisionReportStatus.Pending,
                    Remark = "整改超期自动生成监察上报记录"
                };
                result.Add(await _inspections.AddSupervisionReportAsync(sr));
            }
        }
        return result;
    }

    private async Task<SupervisionReport> BuildSupervisionReportAsync(Inspection ins, string reportType)
    {
        var sr = new SupervisionReport
        {
            ReportCode = $"SUP-{DateTime.Now:yyyyMMddHHmmssfff}-{ins.Id}",
            InspectionId = ins.Id,
            DeviceId = ins.DeviceId,
            DeviceCode = ins.DeviceCode,
            ReportType = reportType,
            Payload = JsonSerializer.Serialize(new
            {
                DeviceCode = ins.DeviceCode,
                DeviceName = ins.DeviceName,
                InspectionCode = ins.InspectionCode,
                InspectionDate = ins.InspectionDate,
                Result = ins.Result.ToString(),
                Conclusion = ins.Conclusion,
                NextInspectionDate = ins.NextInspectionDate
            }),
            Status = SupervisionReportStatus.Pending,
            Remark = "增量上报"
        };
        return await _inspections.AddSupervisionReportAsync(sr);
    }

    public Task<PagedResult<SupervisionReport>> GetSupervisionReportsAsync(SupervisionReportStatus? status, int page, int pageSize)
        => _inspections.GetSupervisionReportsPagedAsync(status, page, pageSize);

    private void EnsureCanAccessInspection(Inspection inspection, CurrentUser user)
    {
        if (user.IsAdmin) return;
        if (user.IsInspector && inspection.InspectorId != user.InspectorId)
            throw new ForbiddenException("仅可操作分配给自己的检验任务");
    }

    private static DateTime CalculateNextInspectionDate(DeviceType type, DateTime baseDate, DateTime? manufacturingDate)
    {
        var ageYears = manufacturingDate.HasValue
            ? Math.Max(0, (baseDate.Date - manufacturingDate.Value.Date).TotalDays / 365.25)
            : 0;

        var intervalMonths = type switch
        {
            DeviceType.Elevator => ageYears > 15 ? 6 : 12,
            DeviceType.Crane => ageYears > 10 ? 6 : 12,
            DeviceType.PressureVessel => ageYears > 10 ? 24 : 36,
            DeviceType.Boiler => ageYears > 10 ? 6 : 12,
            DeviceType.PassengerRopeway => 12,
            DeviceType.LargeAmusementDevice => 12,
            _ => 12
        };
        return baseDate.AddMonths(intervalMonths);
    }

    private static string GetInspectionBasis(DeviceType type) => type switch
    {
        DeviceType.Elevator => "TSG T7001-2009《电梯监督检验和定期检验规则》",
        DeviceType.Crane => "TSG Q7015-2016《起重机械定期检验规则》",
        DeviceType.PressureVessel => "TSG R7001-2013《压力容器定期检验规则》",
        DeviceType.Boiler => "TSG G7002-2015《锅炉定期检验规则》",
        DeviceType.PassengerRopeway => "TSG S7001-2013《客运索道使用管理与维护保养规则》",
        DeviceType.LargeAmusementDevice => "TSG Q7013-2019《大型游乐设施监督检验规程》",
        _ => "相关特种设备检验规程"
    };

    private static string BuildReportHtml(Report report, Inspection? inspection)
    {
        var deviceInfo = string.IsNullOrWhiteSpace(report.DeviceInfo) ? "{}" : report.DeviceInfo;
        var items = string.IsNullOrWhiteSpace(report.ItemsSummary) ? "[]" : report.ItemsSummary;
        var conclusion = report.Conclusion switch
        {
            InspectionResult.Pass => "合格",
            InspectionResult.Fail => "不合格",
            InspectionResult.PassAfterRectification => "整改后合格",
            InspectionResult.Suspended => "停用",
            _ => "-"
        };
        var seal = report.Status == ReportStatus.Approved
            ? $"<div style=\"text-align:right;color:#c00;border:2px solid #c00;border-radius:50%;width:140px;padding:10px;display:inline-block\">电子签章<br/>{report.ReportNo}</div>"
            : "<div style=\"text-align:right;color:#999\">报告未审批</div>";

        return $@"<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'/><title>{report.ReportNo}</title>
<style>body{{font-family:'Microsoft YaHei',sans-serif;padding:30px}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #999;padding:6px}}</style></head><body>
<h2 style='text-align:center'>特种设备定期检验报告</h2>
<p>报告编号：{report.ReportNo}</p>
<table><tr><th>设备信息</th><td><pre>{deviceInfo}</pre></td></tr>
<tr><th>检验依据</th><td>{report.InspectionBasis}</td></tr>
<tr><th>检验项目</th><td><pre>{items}</pre></td></tr>
<tr><th>检验结论</th><td><b>{conclusion}</b></td></tr>
<tr><th>下次检验日期</th><td>{report.NextInspectionDate:yyyy-MM-dd}</td></tr>
<tr><th>生成日期</th><td>{report.GeneratedDate:yyyy-MM-dd HH:mm}</td></tr>
<tr><th>审批人</th><td>{report.ApprovedBy} {report.ApprovedDate:yyyy-MM-dd}</td></tr>
<tr><th>检验编号</th><td>{inspection?.InspectionCode}</td></tr></table>
{seal}</body></html>";
    }

    private static byte[] BuildReportPdf(Report report, Inspection? inspection)
    {
        var deviceInfo = string.IsNullOrWhiteSpace(report.DeviceInfo) ? "{}" : report.DeviceInfo;
        var items = string.IsNullOrWhiteSpace(report.ItemsSummary) ? "[]" : report.ItemsSummary;
        var conclusion = report.Conclusion switch
        {
            InspectionResult.Pass => "合格",
            InspectionResult.Fail => "不合格",
            InspectionResult.PassAfterRectification => "整改后合格",
            InspectionResult.Suspended => "停用",
            _ => "-"
        };
        var statusText = report.Status == ReportStatus.Approved ? "已审批" : "未审批";

        var data = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontFamily(Fonts.Calibri).FontSize(10));
                page.Header().Element(c =>
                {
                    c.Column(column =>
                    {
                        column.Item().AlignCenter().Text("特种设备定期检验报告").FontSize(18).Bold();
                        column.Item().AlignCenter().Text($"报告编号：{report.ReportNo}").FontSize(11).SemiBold();
                        column.Item().PaddingBottom(10).LineHorizontal(1).LineColor(Colors.Grey.Medium);
                    });
                });
                page.Content().Element(c =>
                {
                    c.Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(100);
                            columns.RelativeColumn();
                        });
                        void Cell(string label, string value)
                        {
                            table.Cell().Border(1).BorderColor(Colors.Grey.Medium).Padding(4).Text(label).Bold();
                            table.Cell().Border(1).BorderColor(Colors.Grey.Medium).Padding(4).Text(value);
                        }
                        Cell("设备信息", deviceInfo);
                        Cell("检验依据", report.InspectionBasis);
                        Cell("检验项目", items);
                        Cell("检验结论", conclusion);
                        Cell("下次检验日期", report.NextInspectionDate.HasValue ? report.NextInspectionDate.Value.ToString("yyyy-MM-dd") : "-");
                        Cell("生成日期", report.GeneratedDate.ToString("yyyy-MM-dd HH:mm"));
                        Cell("审批人", $"{report.ApprovedBy} {report.ApprovedDate:yyyy-MM-dd}");
                        Cell("检验编号", inspection?.InspectionCode ?? "-");
                        Cell("报告状态", statusText);
                    });
                });
                page.Footer().AlignRight().Text(x =>
                {
                    x.Span("第 ");
                    x.CurrentPageNumber();
                    x.Span(" / ");
                    x.TotalPages();
                });
            });
        });

        return data.GeneratePdf();
    }

    private ProvincialSupervisionPayload MapToSupervisionPayload(SupervisionReport sup, Inspection? inspection, Device? device, Report? report, Rectification? rect)
    {
        var resultName = inspection?.Result switch
        {
            InspectionResult.Pass => "合格",
            InspectionResult.Fail => "不合格",
            InspectionResult.PassAfterRectification => "整改后合格",
            InspectionResult.Suspended => "停用",
            _ => "未知"
        };
        var typeName = (device?.Type ?? inspection?.DeviceType ?? 0) switch
        {
            DeviceType.Elevator => "电梯",
            DeviceType.Crane => "起重机械",
            DeviceType.PressureVessel => "压力容器",
            DeviceType.Boiler => "锅炉",
            DeviceType.PassengerRopeway => "客运索道",
            DeviceType.LargeAmusementDevice => "大型游乐设施",
            _ => "其他"
        };
        var rectStatusName = rect?.Status switch
        {
            RectificationStatus.Pending => "待整改",
            RectificationStatus.InProgress => "整改中",
            RectificationStatus.Completed => "已完成",
            RectificationStatus.Overdue => "已逾期",
            RectificationStatus.Rejected => "已驳回",
            _ => "未知"
        };
        var inspectionCode = inspection?.InspectionCode ?? $"INSP-{sup.InspectionId:000000}";

        var itemPassCount = 0;
        var itemFailCount = 0;
        if (inspection?.Items != null)
        {
            itemPassCount = inspection.Items.Count(i => i.Result == InspectionResult.Pass);
            itemFailCount = inspection.Items.Count(i => i.Result == InspectionResult.Fail);
        }

        var payload = new ProvincialSupervisionPayload
        {
            OrgCode = _supervisionOptions.OrgCode,
            ReportCode = sup.ReportCode,
            ReportType = sup.ReportType,
            ReportTime = sup.CreatedAt,
            Device = new SupervisionDeviceInfo
            {
                DeviceCode = device?.DeviceCode ?? sup.DeviceCode ?? "",
                DeviceName = device?.Name ?? typeName,
                DeviceType = (int)(device?.Type ?? inspection?.DeviceType ?? 0),
                DeviceTypeName = typeName,
                RegistrationCode = device?.DeviceCode ?? "",
                UserUnit = device?.UseUnitName ?? "",
                UserUnitCode = device?.UseUnitCode ?? "",
                Region = device?.Region ?? "",
                Address = device?.Region ?? "",
                ManufacturingDate = device?.ManufacturingDate,
                InstallationDate = null,
                LastInspectionDate = device?.LastInspectionDate,
                NextInspectionDate = device?.NextInspectionDate
            },
            Inspection = new SupervisionInspectionData
            {
                InspectionCode = inspectionCode,
                InspectionDate = inspection?.InspectionDate ?? sup.CreatedAt,
                InspectionOrg = "某市特种设备检验检测研究院",
                Inspector = inspection?.InspectorName ?? "",
                Result = (int)(inspection?.Result ?? 0),
                ResultName = resultName,
                Conclusion = report?.Conclusion.ToString() ?? inspection?.Conclusion ?? "",
                Basis = report?.InspectionBasis ?? GetInspectionBasis(inspection?.DeviceType ?? 0),
                ItemTotal = inspection?.Items.Count ?? 0,
                ItemPass = itemPassCount,
                ItemFail = itemFailCount,
                Findings = inspection?.Findings,
                NextInspectionDate = inspection?.NextInspectionDate,
                ReportNo = report?.ReportNo,
                ReportDate = report?.GeneratedDate,
                ApprovedBy = report?.ApprovedBy,
                ApprovedDate = report?.ApprovedDate
            }
        };

        if (rect != null)
        {
            payload.Rectification = new SupervisionRectificationData
            {
                RectificationCode = $"RECT-{rect.Id:000000}",
                Description = rect.Description,
                Deadline = rect.Deadline,
                CompletedDate = rect.CompleteDate,
                Status = (int)rect.Status,
                StatusName = rectStatusName,
                Feedback = rect.RectificationResult
            };
        }

        return payload;
    }

    public async Task<SupervisionReport?> SubmitToSupervisionAsync(int supervisionReportId, CurrentUser user)
    {
        if (!user.IsAdmin) throw new ForbiddenException("仅管理员可上报监察平台");

        var sup = await _inspections.GetSupervisionReportByIdAsync(supervisionReportId)
            ?? throw new NotFoundException("监察上报记录不存在");

        if (sup.Status == SupervisionReportStatus.Reported)
            throw new BusinessException("该报告已上报，无需重复上报");

        var inspection = sup.InspectionId.HasValue ? await _inspections.GetInspectionByIdAsync(sup.InspectionId.Value) : null;
        var device = inspection != null ? await _devices.GetByIdAsync(inspection.DeviceId) : null;
        var report = inspection != null ? await _inspections.GetReportByInspectionAsync(inspection.Id) : null;
        var rect = sup.RectificationId.HasValue ? await _inspections.GetRectificationByIdAsync(sup.RectificationId.Value) : null;

        var payload = MapToSupervisionPayload(sup, inspection, device, report, rect);
        sup.Payload = JsonSerializer.Serialize(payload, ReportJsonOptions);
        sup.Status = SupervisionReportStatus.Reporting;
        sup.ReportedAt = DateTime.Now;
        await _inspections.UpdateSupervisionReportAsync(sup);

        var (success, response, error) = await _supervisionClient.SubmitReportAsync(payload);

        if (success)
        {
            sup.Status = SupervisionReportStatus.Reported;
            sup.Remark = response;
            _logger.LogInformation("监察上报成功：{ReportCode}", sup.ReportCode);
        }
        else
        {
            sup.Status = SupervisionReportStatus.Failed;
            sup.Remark = error ?? response;
            _logger.LogError("监察上报失败：{ReportCode} - {Error}", sup.ReportCode, error);
        }

        await _inspections.UpdateSupervisionReportAsync(sup);
        return sup;
    }
}
