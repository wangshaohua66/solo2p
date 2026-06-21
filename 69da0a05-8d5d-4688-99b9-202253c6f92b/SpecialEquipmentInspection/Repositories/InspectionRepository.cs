using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public class InspectionRepository : IInspectionRepository
{
    private readonly AppDbContext _db;
    public InspectionRepository(AppDbContext db) => _db = db;

    public Task<Inspection?> GetInspectionByIdAsync(int id)
        => _db.Inspections
            .AsNoTracking()
            .Include(i => i.Items)
            .Include(i => i.Rectifications)
            .Include(i => i.Device)
            .FirstOrDefaultAsync(i => i.Id == id);

    public Task<Inspection?> GetInspectionByCodeAsync(string code)
        => _db.Inspections.AsNoTracking().FirstOrDefaultAsync(i => i.InspectionCode == code);

    public Task<bool> ExistsByCodeAsync(string code)
        => _db.Inspections.AnyAsync(i => i.InspectionCode == code);

    public async Task<PagedResult<Inspection>> GetInspectionsPagedAsync(
        int? deviceId = null, int? inspectorId = null, InspectionStatus? status = null,
        InspectionResult? result = null, int? planId = null, string? useUnitCode = null,
        DateTime? dateFrom = null, DateTime? dateTo = null,
        int page = 1, int pageSize = 20)
    {
        var q = _db.Inspections.AsNoTracking().AsQueryable();

        if (deviceId.HasValue) q = q.Where(i => i.DeviceId == deviceId.Value);
        if (inspectorId.HasValue) q = q.Where(i => i.InspectorId == inspectorId.Value);
        if (status.HasValue) q = q.Where(i => i.Status == status.Value);
        if (result.HasValue) q = q.Where(i => i.Result == result.Value);
        if (planId.HasValue) q = q.Where(i => i.PlanId == planId.Value);
        if (dateFrom.HasValue) q = q.Where(i => i.ScheduledDate >= dateFrom.Value);
        if (dateTo.HasValue) q = q.Where(i => i.ScheduledDate <= dateTo.Value);
        if (!string.IsNullOrWhiteSpace(useUnitCode))
        {
            var ids = _db.Devices.Where(d => d.UseUnitCode == useUnitCode).Select(d => d.Id);
            q = q.Where(i => ids.Contains(i.DeviceId));
        }

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(i => i.ScheduledDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Inspection> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public Task<List<Inspection>> GetInspectionsByInspectorAsync(int inspectorId)
        => _db.Inspections.AsNoTracking()
            .Where(i => i.InspectorId == inspectorId)
            .OrderByDescending(i => i.ScheduledDate)
            .ToListAsync();

    public async Task<Inspection> AddInspectionAsync(Inspection inspection)
    {
        inspection.CreatedAt = DateTime.Now;
        inspection.UpdatedAt = DateTime.Now;
        _db.Inspections.Add(inspection);
        await _db.SaveChangesAsync();
        return inspection;
    }

    public async Task UpdateInspectionAsync(Inspection inspection)
    {
        var existing = await _db.Inspections.FindAsync(inspection.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(inspection);
        existing.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public Task<InspectionItem?> GetItemAsync(int id)
        => _db.InspectionItems.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);

    public async Task AddItemAsync(InspectionItem item)
    {
        item.CreatedAt = DateTime.Now;
        _db.InspectionItems.Add(item);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateItemAsync(InspectionItem item)
    {
        var existing = await _db.InspectionItems.FindAsync(item.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(item);
        await _db.SaveChangesAsync();
    }

    public async Task ReplaceItemsAsync(int inspectionId, List<InspectionItem> items)
    {
        var existing = await _db.InspectionItems.Where(t => t.InspectionId == inspectionId).ToListAsync();
        _db.InspectionItems.RemoveRange(existing);
        var now = DateTime.Now;
        foreach (var it in items)
        {
            it.InspectionId = inspectionId;
            it.CreatedAt = now;
            _db.InspectionItems.Add(it);
        }
        await _db.SaveChangesAsync();
    }

    public async Task<InspectionPlan> AddPlanAsync(InspectionPlan plan)
    {
        plan.CreatedAt = DateTime.Now;
        _db.InspectionPlans.Add(plan);
        await _db.SaveChangesAsync();
        return plan;
    }

    public Task<InspectionPlan?> GetPlanAsync(int id)
        => _db.InspectionPlans.AsNoTracking()
            .Include(p => p.Inspections)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<PagedResult<InspectionPlan>> GetPlansPagedAsync(int? year, string? region, PlanStatus? status, int page = 1, int pageSize = 20)
    {
        var q = _db.InspectionPlans.AsNoTracking().AsQueryable();
        if (year.HasValue) q = q.Where(p => p.Year == year.Value);
        if (!string.IsNullOrWhiteSpace(region)) q = q.Where(p => p.Region == region);
        if (status.HasValue) q = q.Where(p => p.Status == status.Value);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<InspectionPlan> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public async Task UpdatePlanAsync(InspectionPlan plan)
    {
        var existing = await _db.InspectionPlans.FindAsync(plan.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(plan);
        await _db.SaveChangesAsync();
    }

    public Task<Rectification?> GetRectificationAsync(int id)
        => _db.Rectifications.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);

    public async Task<Rectification> AddRectificationAsync(Rectification rectification)
    {
        rectification.CreatedAt = DateTime.Now;
        rectification.UpdatedAt = DateTime.Now;
        _db.Rectifications.Add(rectification);
        await _db.SaveChangesAsync();
        return rectification;
    }

    public async Task UpdateRectificationAsync(Rectification rectification)
    {
        var existing = await _db.Rectifications.FindAsync(rectification.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(rectification);
        existing.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public async Task<PagedResult<Rectification>> GetRectificationsPagedAsync(
        int? inspectionId = null, int? deviceId = null, string? useUnitCode = null,
        RectificationStatus? status = null, int page = 1, int pageSize = 20)
    {
        var q = _db.Rectifications.AsNoTracking().AsQueryable();
        if (inspectionId.HasValue) q = q.Where(r => r.InspectionId == inspectionId.Value);
        if (deviceId.HasValue) q = q.Where(r => r.DeviceId == deviceId.Value);
        if (!string.IsNullOrWhiteSpace(useUnitCode)) q = q.Where(r => r.UseUnitCode == useUnitCode);
        if (status.HasValue) q = q.Where(r => r.Status == status.Value);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(r => r.Deadline)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Rectification> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public Task<List<Rectification>> GetOverdueRectificationsAsync()
    {
        var now = DateTime.Now;
        return _db.Rectifications
            .Where(r => r.Status != RectificationStatus.Completed && r.Status != RectificationStatus.Rejected && r.Deadline < now)
            .ToListAsync();
    }

    public Task<List<Rectification>> GetRectificationsByUseUnitAsync(string useUnitCode)
        => _db.Rectifications.AsNoTracking()
            .Where(r => r.UseUnitCode == useUnitCode)
            .OrderByDescending(r => r.Deadline)
            .ToListAsync();

    public Task<Report?> GetReportAsync(int id)
        => _db.Reports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);

    public Task<Report?> GetReportByInspectionAsync(int inspectionId)
        => _db.Reports.AsNoTracking().FirstOrDefaultAsync(r => r.InspectionId == inspectionId);

    public async Task<Report> AddReportAsync(Report report)
    {
        report.CreatedAt = DateTime.Now;
        _db.Reports.Add(report);
        await _db.SaveChangesAsync();
        return report;
    }

    public async Task UpdateReportAsync(Report report)
    {
        var existing = await _db.Reports.FindAsync(report.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(report);
        await _db.SaveChangesAsync();
    }

    public async Task<SupervisionReport> AddSupervisionReportAsync(SupervisionReport report)
    {
        report.CreatedAt = DateTime.Now;
        _db.SupervisionReports.Add(report);
        await _db.SaveChangesAsync();
        return report;
    }

    public Task<List<SupervisionReport>> GetPendingSupervisionReportsAsync()
        => _db.SupervisionReports.Where(s => s.Status == SupervisionReportStatus.Pending).ToListAsync();

    public async Task UpdateSupervisionReportAsync(SupervisionReport report)
    {
        var existing = await _db.SupervisionReports.FindAsync(report.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(report);
        await _db.SaveChangesAsync();
    }

    public async Task<PagedResult<Report>> GetReportsPagedAsync(ReportStatus? status, int page, int pageSize)
    {
        var q = _db.Reports.AsNoTracking().AsQueryable();
        if (status.HasValue) q = q.Where(r => r.Status == status.Value);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(r => r.GeneratedDate)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<Report> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public async Task<PagedResult<SupervisionReport>> GetSupervisionReportsPagedAsync(SupervisionReportStatus? status, int page, int pageSize)
    {
        var q = _db.SupervisionReports.AsNoTracking().AsQueryable();
        if (status.HasValue) q = q.Where(s => s.Status == status.Value);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<SupervisionReport> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public async Task<InspectionStatistics> GetStatisticsAsync(int? year, string? region)
    {
        var inspectQ = _db.Inspections.AsNoTracking().AsQueryable();
        var deviceIds = region == null ? null : _db.Devices.Where(d => d.Region == region).Select(d => d.Id);
        if (deviceIds != null) inspectQ = inspectQ.Where(i => deviceIds.Contains(i.DeviceId));
        if (year.HasValue)
        {
            var start = new DateTime(year.Value, 1, 1);
            var end = new DateTime(year.Value, 12, 31);
            inspectQ = inspectQ.Where(i => i.ScheduledDate >= start && i.ScheduledDate <= end);
        }

        var stats = new InspectionStatistics
        {
            TotalInspections = await inspectQ.CountAsync(),
            CompletedCount = await inspectQ.Where(i => i.Status == InspectionStatus.Completed || i.Status == InspectionStatus.Approved).CountAsync(),
            PassCount = await inspectQ.Where(i => i.Result == InspectionResult.Pass).CountAsync(),
            FailCount = await inspectQ.Where(i => i.Result == InspectionResult.Fail).CountAsync(),
            PassAfterRectificationCount = await inspectQ.Where(i => i.Result == InspectionResult.PassAfterRectification).CountAsync(),
            SuspendedCount = await inspectQ.Where(i => i.Result == InspectionResult.Suspended).CountAsync()
        };

        var rectQ = _db.Rectifications.AsNoTracking().AsQueryable();
        if (deviceIds != null) rectQ = rectQ.Where(r => deviceIds.Contains(r.DeviceId));
        stats.TotalRectifications = await rectQ.CountAsync();
        stats.CompletedRectifications = await rectQ.Where(r => r.Status == RectificationStatus.Completed).CountAsync();
        stats.OverdueRectifications = await rectQ.Where(r => r.Status == RectificationStatus.Overdue).CountAsync();

        return stats;
    }

    public async Task<TimeSeriesStatistics> GetTimeSeriesStatisticsAsync(
        DateTime dateFrom, DateTime dateTo, TimeDimension dimension, string? region, DeviceType? deviceType)
    {
        dateFrom = dateFrom.Date;
        dateTo = dateTo.Date;

        var result = new TimeSeriesStatistics
        {
            Dimension = dimension,
            DateFrom = dateFrom,
            DateTo = dateTo,
            Region = region,
            DeviceType = deviceType
        };

        var inspectQ = _db.Inspections.AsNoTracking().AsQueryable();
        var deviceQ = _db.Devices.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(region))
        {
            var deviceIds = deviceQ.Where(d => d.Region == region).Select(d => d.Id);
            inspectQ = inspectQ.Where(i => deviceIds.Contains(i.DeviceId));
            deviceQ = deviceQ.Where(d => d.Region == region);
        }

        if (deviceType.HasValue)
        {
            inspectQ = inspectQ.Where(i => i.DeviceType == deviceType.Value);
            deviceQ = deviceQ.Where(d => d.Type == deviceType.Value);
        }

        inspectQ = inspectQ.Where(i => i.CreatedAt >= dateFrom && i.CreatedAt <= dateTo.AddDays(1));
        var rectQ = _db.Rectifications.AsNoTracking().Where(r => r.CreatedAt >= dateFrom && r.CreatedAt <= dateTo.AddDays(1));

        var inspectList = await inspectQ.ToListAsync();
        var rectList = await rectQ.ToListAsync();

        result.Summary = new InspectionStatistics
        {
            TotalInspections = inspectList.Count,
            CompletedCount = inspectList.Count(i => i.Status == InspectionStatus.Completed || i.Status == InspectionStatus.Approved),
            PassCount = inspectList.Count(i => i.Result == InspectionResult.Pass),
            FailCount = inspectList.Count(i => i.Result == InspectionResult.Fail),
            PassAfterRectificationCount = inspectList.Count(i => i.Result == InspectionResult.PassAfterRectification),
            SuspendedCount = inspectList.Count(i => i.Result == InspectionResult.Suspended),
            TotalRectifications = rectList.Count,
            CompletedRectifications = rectList.Count(r => r.Status == RectificationStatus.Completed),
            OverdueRectifications = rectList.Count(r => r.Status == RectificationStatus.Overdue)
        };

        var periods = GeneratePeriods(dateFrom, dateTo, dimension);

        foreach (var (period, start, end) in periods)
        {
            var point = new TimeSeriesPoint
            {
                Period = period,
                PeriodStart = start,
                PeriodEnd = end,
                TotalInspections = inspectList.Count(i => i.CreatedAt >= start && i.CreatedAt < end),
                CompletedCount = inspectList.Count(i => (i.Status == InspectionStatus.Completed || i.Status == InspectionStatus.Approved)
                    && i.InspectionDate.HasValue && i.InspectionDate.Value >= start && i.InspectionDate.Value < end),
                PassCount = inspectList.Count(i => i.Result == InspectionResult.Pass
                    && i.InspectionDate.HasValue && i.InspectionDate.Value >= start && i.InspectionDate.Value < end),
                FailCount = inspectList.Count(i => i.Result == InspectionResult.Fail
                    && i.InspectionDate.HasValue && i.InspectionDate.Value >= start && i.InspectionDate.Value < end),
                RectificationCount = rectList.Count(r => r.CreatedAt >= start && r.CreatedAt < end),
                CompletedRectifications = rectList.Count(r => r.Status == RectificationStatus.Completed
                    && r.CompleteDate.HasValue && r.CompleteDate.Value >= start && r.CompleteDate.Value < end)
            };

            point.CompletionRate = point.TotalInspections == 0 ? 0 : Math.Round(point.CompletedCount * 100.0 / point.TotalInspections, 2);
            point.PassRate = point.CompletedCount == 0 ? 0 : Math.Round(point.PassCount * 100.0 / point.CompletedCount, 2);

            result.Series.Add(point);
        }

        return result;
    }

    public async Task<SupervisionReport?> GetSupervisionReportByIdAsync(int id)
    {
        return await _db.SupervisionReports.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<Rectification?> GetRectificationByIdAsync(int id)
    {
        return await _db.Rectifications.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    private static List<(string Period, DateTime Start, DateTime End)> GeneratePeriods(DateTime dateFrom, DateTime dateTo, TimeDimension dimension)
    {
        var periods = new List<(string, DateTime, DateTime)>();
        var current = dateFrom;

        while (current <= dateTo)
        {
            switch (dimension)
            {
                case TimeDimension.Month:
                    var monthStart = new DateTime(current.Year, current.Month, 1);
                    var monthEnd = monthStart.AddMonths(1);
                    periods.Add(($"{current.Year}-{current.Month:00}", monthStart, monthEnd));
                    current = monthEnd;
                    break;
                case TimeDimension.Quarter:
                    var qnum = (current.Month - 1) / 3;
                    var qStart = new DateTime(current.Year, qnum * 3 + 1, 1);
                    var qEnd = qStart.AddMonths(3);
                    periods.Add(($"{current.Year}Q{qnum + 1}", qStart, qEnd));
                    current = qEnd;
                    break;
                case TimeDimension.Year:
                    var yStart = new DateTime(current.Year, 1, 1);
                    var yEnd = yStart.AddYears(1);
                    periods.Add(($"{current.Year}", yStart, yEnd));
                    current = yEnd;
                    break;
            }
        }

        return periods;
    }
}
