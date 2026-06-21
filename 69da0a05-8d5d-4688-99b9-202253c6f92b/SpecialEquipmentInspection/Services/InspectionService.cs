using System.Text.Json;
using Microsoft.Extensions.Options;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;

namespace SpecialEquipmentInspection.Services;

public class InspectionOptions
{
    public int MaxPhotosPerInspection { get; set; } = 20;
    public int MaxPhotoSizeMB { get; set; } = 5;
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
    private readonly ILogger<InspectionService> _logger;

    public InspectionService(
        IDeviceRepository devices,
        IInspectionRepository inspections,
        IInspectorRepository inspectors,
        IOptions<InspectionOptions> options,
        ILogger<InspectionService> logger)
    {
        _devices = devices;
        _inspections = inspections;
        _inspectors = inspectors;
        _options = options.Value;
        _logger = logger;
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
            PlanCode = $"PL-{dto.Year}-{DateTime.Now:MMddHHmmss}",
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
                InspectionCode = $"INS-{dto.Year}{DateTime.Now:MMdd}-{sequence:D4}",
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
            InspectionCode = $"INS-{DateTime.Now:yyyyMMddHHmmss}",
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

        inspection.Status = InspectionStatus.Completed;
        inspection.Result = dto.Result;
        inspection.Conclusion = dto.Conclusion;
        inspection.InspectionDate ??= DateTime.Now;
        inspection.Photos = JsonSerializer.Serialize(dto.Photos);
        inspection.Findings = dto.Findings;
        inspection.NextInspectionDate = dto.NextInspectionDate ?? CalculateNextInspectionDate(inspection.DeviceType, DateTime.Now);
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

        var device = await _devices.GetByIdAsync(inspection.DeviceId);
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
            ReportNo = $"RPT-{DateTime.Now:yyyyMMddHHmmss}",
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

    public async Task<(string Content, string FileName)> ExportReportAsync(int reportId)
    {
        var report = await _inspections.GetReportAsync(reportId)
            ?? throw new NotFoundException("报告不存在");
        var inspection = await _inspections.GetInspectionByIdAsync(report.InspectionId);
        var html = BuildReportHtml(report, inspection);
        return (html, $"{report.ReportNo}.html");
    }

    public Task<InspectionStatistics> GetStatisticsAsync(int? year, string? region)
        => _inspections.GetStatisticsAsync(year, region);

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
                    ReportCode = $"SUP-{DateTime.Now:yyyyMMddHHmmss}-{rect.Id}",
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
            ReportCode = $"SUP-{DateTime.Now:yyyyMMddHHmmss}-{ins.Id}",
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

    private static DateTime CalculateNextInspectionDate(DeviceType type, DateTime baseDate)
    {
        var intervalMonths = type switch
        {
            DeviceType.PassengerRopeway => 12,
            DeviceType.LargeAmusementDevice => 12,
            DeviceType.Boiler => 12,
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
}
