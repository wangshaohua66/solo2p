using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public interface IInspectionRepository
{
    Task<Inspection?> GetInspectionByIdAsync(int id);
    Task<Inspection?> GetInspectionByCodeAsync(string code);
    Task<bool> ExistsByCodeAsync(string code);
    Task<PagedResult<Inspection>> GetInspectionsPagedAsync(
        int? deviceId = null,
        int? inspectorId = null,
        InspectionStatus? status = null,
        InspectionResult? result = null,
        int? planId = null,
        string? useUnitCode = null,
        DateTime? dateFrom = null,
        DateTime? dateTo = null,
        int page = 1,
        int pageSize = 20);
    Task<List<Inspection>> GetInspectionsByInspectorAsync(int inspectorId);
    Task<Inspection> AddInspectionAsync(Inspection inspection);
    Task UpdateInspectionAsync(Inspection inspection);

    Task<InspectionItem?> GetItemAsync(int id);
    Task AddItemAsync(InspectionItem item);
    Task UpdateItemAsync(InspectionItem item);
    Task ReplaceItemsAsync(int inspectionId, List<InspectionItem> items);

    Task<InspectionPlan> AddPlanAsync(InspectionPlan plan);
    Task<InspectionPlan?> GetPlanAsync(int id);
    Task<PagedResult<InspectionPlan>> GetPlansPagedAsync(int? year, string? region, PlanStatus? status, int page = 1, int pageSize = 20);
    Task UpdatePlanAsync(InspectionPlan plan);

    Task<Rectification?> GetRectificationAsync(int id);
    Task<Rectification> AddRectificationAsync(Rectification rectification);
    Task UpdateRectificationAsync(Rectification rectification);
    Task<PagedResult<Rectification>> GetRectificationsPagedAsync(
        int? inspectionId = null, int? deviceId = null, string? useUnitCode = null,
        RectificationStatus? status = null, int page = 1, int pageSize = 20);
    Task<List<Rectification>> GetOverdueRectificationsAsync();
    Task<List<Rectification>> GetRectificationsByUseUnitAsync(string useUnitCode);

    Task<Report?> GetReportAsync(int id);
    Task<Report?> GetReportByInspectionAsync(int inspectionId);
    Task<Report> AddReportAsync(Report report);
    Task UpdateReportAsync(Report report);

    Task<SupervisionReport> AddSupervisionReportAsync(SupervisionReport report);
    Task<List<SupervisionReport>> GetPendingSupervisionReportsAsync();
    Task UpdateSupervisionReportAsync(SupervisionReport report);
    Task<PagedResult<Report>> GetReportsPagedAsync(ReportStatus? status, int page, int pageSize);
    Task<PagedResult<SupervisionReport>> GetSupervisionReportsPagedAsync(SupervisionReportStatus? status, int page, int pageSize);

    Task<InspectionStatistics> GetStatisticsAsync(int? year, string? region);

    Task<TimeSeriesStatistics> GetTimeSeriesStatisticsAsync(DateTime dateFrom, DateTime dateTo, TimeDimension dimension, string? region, DeviceType? deviceType);

    Task<SupervisionReport?> GetSupervisionReportByIdAsync(int id);

    Task<Rectification?> GetRectificationByIdAsync(int id);
}

public class InspectionStatistics
{
    public int TotalInspections { get; set; }
    public int CompletedCount { get; set; }
    public int PassCount { get; set; }
    public int FailCount { get; set; }
    public int PassAfterRectificationCount { get; set; }
    public int SuspendedCount { get; set; }
    public int TotalRectifications { get; set; }
    public int CompletedRectifications { get; set; }
    public int OverdueRectifications { get; set; }
    public double CompletionRate => TotalInspections == 0 ? 0 : Math.Round(CompletedCount * 100.0 / TotalInspections, 2);
    public double PassRate => CompletedCount == 0 ? 0 : Math.Round((PassCount + PassAfterRectificationCount) * 100.0 / CompletedCount, 2);
    public double RectificationCompletionRate => TotalRectifications == 0 ? 0 : Math.Round(CompletedRectifications * 100.0 / TotalRectifications, 2);
}

public enum TimeDimension { Month = 1, Quarter = 2, Year = 3 }

public class TimeSeriesPoint
{
    public string Period { get; set; } = string.Empty;
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public int TotalInspections { get; set; }
    public int CompletedCount { get; set; }
    public int PassCount { get; set; }
    public int FailCount { get; set; }
    public int RectificationCount { get; set; }
    public int CompletedRectifications { get; set; }
    public double CompletionRate { get; set; }
    public double PassRate { get; set; }
}

public class TimeSeriesStatistics
{
    public TimeDimension Dimension { get; set; }
    public DateTime DateFrom { get; set; }
    public DateTime DateTo { get; set; }
    public string? Region { get; set; }
    public DeviceType? DeviceType { get; set; }
    public InspectionStatistics Summary { get; set; } = new();
    public List<TimeSeriesPoint> Series { get; set; } = new();
}
