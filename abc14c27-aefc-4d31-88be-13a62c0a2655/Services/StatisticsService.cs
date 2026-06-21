using AutoMapper;
using Microsoft.EntityFrameworkCore;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class StatisticsService : IStatisticsService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<StatisticsService> _logger;

    public StatisticsService(
        ApplicationDbContext context,
        IMapper mapper,
        ILogger<StatisticsService> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ApiResponse<TransactionStatisticsDto>> GetTransactionStatisticsAsync(StatisticsQueryDto dto)
    {
        _logger.LogInformation("Getting transaction statistics: {Start} to {End}", dto.StartDate, dto.EndDate);

        var query = _context.VehicleTransactions
            .AsNoTracking()
            .Where(t => t.TransactionDate >= dto.StartDate && t.TransactionDate <= dto.EndDate);

        var totalTransactions = await query.CountAsync();
        var totalAmount = await query.SumAsync(t => (decimal?)t.TransactionPrice) ?? 0;

        var pendingCount = await query.CountAsync(t => t.Status == TransactionStatus.Created || t.Status == TransactionStatus.PendingWorkflow);
        var inProgressCount = await query.CountAsync(t => t.Status == TransactionStatus.InProgress || t.Status == TransactionStatus.Suspended);
        var completedCount = await query.CountAsync(t => t.Status == TransactionStatus.Completed);

        var result = new TransactionStatisticsDto
        {
            TotalTransactions = totalTransactions,
            TotalTransactionAmount = Math.Round(totalAmount, 2),
            AverageTransactionPrice = totalTransactions > 0 ? Math.Round(totalAmount / totalTransactions, 2) : 0,
            PendingCount = pendingCount,
            InProgressCount = inProgressCount,
            CompletedCount = completedCount
        };

        return ApiResponse<TransactionStatisticsDto>.Success(result);
    }

    public async Task<ApiResponse<List<BrandStatisticsDto>>> GetBrandStatisticsAsync(StatisticsQueryDto dto)
    {
        var stats = await _context.VehicleTransactions
            .AsNoTracking()
            .Where(t => t.TransactionDate >= dto.StartDate && t.TransactionDate <= dto.EndDate &&
                        t.Vehicle != null && t.Vehicle.Brand != null && t.Vehicle.Brand != "")
            .GroupBy(t => t.Vehicle!.Brand)
            .Select(g => new BrandStatisticsDto
            {
                Brand = g.Key,
                Count = g.Count(),
                TotalAmount = Math.Round(g.Sum(t => t.TransactionPrice), 2),
                Percentage = 0
            })
            .OrderByDescending(s => s.Count)
            .ToListAsync();

        var total = stats.Sum(s => s.Count);
        foreach (var s in stats)
        {
            s.Percentage = total > 0 ? Math.Round((decimal)s.Count / total * 100, 2) : 0;
        }

        return ApiResponse<List<BrandStatisticsDto>>.Success(stats);
    }

    public async Task<ApiResponse<List<ModelStatisticsDto>>> GetModelStatisticsAsync(StatisticsQueryDto dto, int topN = 20)
    {
        var stats = await _context.VehicleTransactions
            .AsNoTracking()
            .Where(t => t.TransactionDate >= dto.StartDate && t.TransactionDate <= dto.EndDate &&
                        t.Vehicle != null && t.Vehicle.Brand != null && t.Vehicle.Model != null)
            .GroupBy(t => new { t.Vehicle!.Brand, t.Vehicle.Model })
            .Select(g => new ModelStatisticsDto
            {
                Brand = g.Key.Brand,
                Model = g.Key.Model,
                Count = g.Count(),
                TotalAmount = Math.Round(g.Sum(t => t.TransactionPrice), 2)
            })
            .OrderByDescending(s => s.Count)
            .Take(topN)
            .ToListAsync();

        return ApiResponse<List<ModelStatisticsDto>>.Success(stats);
    }

    public async Task<ApiResponse<List<InspectionGradeStatisticsDto>>> GetInspectionGradeStatisticsAsync(StatisticsQueryDto dto)
    {
        var query = _context.InspectionOrders
            .AsNoTracking()
            .Where(o => o.EndTime.HasValue &&
                        o.EndTime.Value >= dto.StartDate && o.EndTime.Value <= dto.EndDate &&
                        o.Grade.HasValue);

        var total = await query.CountAsync();

        var allGrades = new[]
        {
            new { Grade = InspectionGrade.Excellent, Name = "优秀", NameEn = "Excellent" },
            new { Grade = InspectionGrade.Good, Name = "良好", NameEn = "Good" },
            new { Grade = InspectionGrade.Fair, Name = "一般", NameEn = "Fair" },
            new { Grade = InspectionGrade.Poor, Name = "较差", NameEn = "Poor" }
        };

        var stats = new List<InspectionGradeStatisticsDto>();

        foreach (var g in allGrades)
        {
            var count = await query.CountAsync(o => o.Grade == g.Grade);
            var avgScore = count > 0
                ? Math.Round(await query.Where(o => o.Grade == g.Grade).AverageAsync(o => o.TotalScore), 2)
                : 0;

            stats.Add(new InspectionGradeStatisticsDto
            {
                Grade = g.Grade,
                GradeName = g.Name,
                Count = count,
                Percentage = total > 0 ? Math.Round((decimal)count / total * 100, 2) : 0,
                AverageScore = avgScore
            });
        }

        return ApiResponse<List<InspectionGradeStatisticsDto>>.Success(stats);
    }

    public async Task<ApiResponse<WorkflowTimelinessDto>> GetWorkflowTimelinessAsync(StatisticsQueryDto dto)
    {
        var instances = await _context.WorkflowInstances
            .AsNoTracking()
            .Include(i => i.NodeExecutions)
            .Where(i => i.StartTime.HasValue &&
                        i.StartTime.Value >= dto.StartDate && i.StartTime.Value <= dto.EndDate)
            .ToListAsync();

        var totalInstances = instances.Count;
        var completedInstances = instances.Where(i => i.Status == WorkflowNodeStatus.Completed).ToList();

        var onTimeCompleted = completedInstances
            .Count(i => i.NodeExecutions != null &&
                        i.NodeExecutions.All(n => n.Status != WorkflowNodeStatus.TimedOut));

        var timedOut = instances
            .Count(i => i.HasTimedOutNodes ||
                        (i.NodeExecutions != null &&
                         i.NodeExecutions.Any(n => n.Status == WorkflowNodeStatus.TimedOut)));

        var avgDuration = completedInstances.Any() && completedInstances.All(i => i.TotalDurationMinutes.HasValue)
            ? Math.Round(completedInstances.Average(i => i.TotalDurationMinutes!.Value), 2)
            : 0;

        var nodeTimelinessList = new List<WorkflowNodeTimelinessDto>();

        var nodeGroups = instances
            .SelectMany(i => i.NodeExecutions ?? new List<WorkflowNodeExecution>())
            .Where(n => n.EndTime.HasValue)
            .GroupBy(n => n.NodeType)
            .ToList();

        foreach (var group in nodeGroups)
        {
            var nodeName = group.First().NodeName;
            var totalExec = group.Count();
            var timedOutCount = group.Count(n => n.Status == WorkflowNodeStatus.TimedOut);
            var onTimeCount = totalExec - timedOutCount;
            var avgNodeDuration = group.All(n => n.DurationMinutes.HasValue)
                ? Math.Round(group.Average(n => n.DurationMinutes!.Value), 2)
                : 0;

            nodeTimelinessList.Add(new WorkflowNodeTimelinessDto
            {
                NodeType = group.Key,
                NodeName = nodeName,
                TotalExecutions = totalExec,
                OnTimeCount = onTimeCount,
                TimedOutCount = timedOutCount,
                OnTimeRate = totalExec > 0 ? Math.Round((double)onTimeCount / totalExec * 100, 2) : 0,
                AverageDurationMinutes = avgNodeDuration
            });
        }

        var result = new WorkflowTimelinessDto
        {
            TotalInstances = totalInstances,
            OnTimeCompleted = onTimeCompleted,
            TimedOut = timedOut,
            OnTimeRate = totalInstances > 0 ? Math.Round((double)onTimeCompleted / totalInstances * 100, 2) : 0,
            AverageDurationMinutes = avgDuration,
            NodeTimeliness = nodeTimelinessList.OrderBy(n => n.NodeType).ToList()
        };

        return ApiResponse<WorkflowTimelinessDto>.Success(result);
    }

    public async Task<ApiResponse<ExceptionCaseStatisticsDto>> GetExceptionCaseStatisticsAsync(StatisticsQueryDto dto)
    {
        var query = _context.ExceptionCases
            .AsNoTracking()
            .Where(c => c.CreatedAt >= dto.StartDate && c.CreatedAt <= dto.EndDate);

        var totalCases = await query.CountAsync();
        var openCases = await query.CountAsync(c =>
            c.Status == ExceptionCaseStatus.Created ||
            c.Status == ExceptionCaseStatus.UnderInvestigation ||
            c.Status == ExceptionCaseStatus.PendingApproval ||
            c.Status == ExceptionCaseStatus.InProcess);

        var resolvedCases = await query.CountAsync(c =>
            c.Status == ExceptionCaseStatus.Resolved ||
            c.Status == ExceptionCaseStatus.Closed);

        var resolvedWithTime = await query
            .Where(c => c.ResolvedAt.HasValue)
            .Select(c => new { c.CreatedAt, c.ResolvedAt })
            .ToListAsync();

        var avgResolutionDays = resolvedWithTime.Any()
            ? Math.Round(resolvedWithTime.Average(c => (c.ResolvedAt!.Value - c.CreatedAt).TotalDays), 2)
            : 0;

        var typeStats = await query
            .GroupBy(c => new { c.CaseType, c.CaseTypeName })
            .Select(g => new ExceptionCaseTypeStatisticsDto
            {
                CaseType = g.Key.CaseType,
                CaseTypeName = g.Key.CaseTypeName,
                Count = g.Count(),
                Percentage = 0
            })
            .OrderByDescending(s => s.Count)
            .ToListAsync();

        foreach (var s in typeStats)
        {
            s.Percentage = totalCases > 0 ? Math.Round((decimal)s.Count / totalCases * 100, 2) : 0;
        }

        var result = new ExceptionCaseStatisticsDto
        {
            TotalCases = totalCases,
            OpenCases = openCases,
            ResolvedCases = resolvedCases,
            ResolutionRate = totalCases > 0 ? Math.Round((double)resolvedCases / totalCases * 100, 2) : 0,
            AverageResolutionDays = avgResolutionDays,
            TypeStatistics = typeStats
        };

        return ApiResponse<ExceptionCaseStatisticsDto>.Success(result);
    }

    public async Task<ApiResponse<List<DailyStatisticsDto>>> GetDailyTrendAsync(StatisticsQueryDto dto)
    {
        var granularity = dto.Granularity?.ToLower() ?? "day";

        var startDate = dto.StartDate.Date;
        var endDate = dto.EndDate.Date;
        var dates = GetDateRange(startDate, endDate, granularity);

        var vehicleTask = _context.Vehicles
            .AsNoTracking()
            .Where(v => v.CreatedAt >= startDate && v.CreatedAt <= endDate.AddDays(1))
            .Select(v => new { v.CreatedAt.Date, v.CreatedAt })
            .ToListAsync();

        var complianceTask = _context.ComplianceCheckRecords
            .AsNoTracking()
            .Where(c => c.CheckTime >= startDate && c.CheckTime <= endDate.AddDays(1))
            .Select(c => new { c.CheckTime.Date })
            .ToListAsync();

        var inspectionTask = _context.InspectionOrders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate.AddDays(1))
            .Select(o => new { o.CreatedAt.Date })
            .ToListAsync();

        var transactionTask = _context.VehicleTransactions
            .AsNoTracking()
            .Where(t => t.TransactionDate >= startDate && t.TransactionDate <= endDate.AddDays(1))
            .Select(t => new { t.TransactionDate.Date })
            .ToListAsync();

        var exceptionNewTask = _context.ExceptionCases
            .AsNoTracking()
            .Where(e => e.CreatedAt >= startDate && e.CreatedAt <= endDate.AddDays(1))
            .Select(e => new { e.CreatedAt.Date })
            .ToListAsync();

        var exceptionResolvedTask = _context.ExceptionCases
            .AsNoTracking()
            .Where(e => e.ResolvedAt.HasValue && e.ResolvedAt >= startDate && e.ResolvedAt <= endDate.AddDays(1))
            .Select(e => new { e.ResolvedAt!.Value.Date })
            .ToListAsync();

        await Task.WhenAll(vehicleTask, complianceTask, inspectionTask, transactionTask, exceptionNewTask, exceptionResolvedTask);

        var result = new List<DailyStatisticsDto>();

        foreach (var date in dates)
        {
            var d = date.Date;
            result.Add(new DailyStatisticsDto
            {
                Date = d,
                NewVehicles = vehicleTask.Result.Count(v => GetGroupKey(v.Date, granularity) == GetGroupKey(d, granularity)),
                ComplianceChecks = complianceTask.Result.Count(c => GetGroupKey(c.Date, granularity) == GetGroupKey(d, granularity)),
                Inspections = inspectionTask.Result.Count(o => GetGroupKey(o.Date, granularity) == GetGroupKey(d, granularity)),
                Transactions = transactionTask.Result.Count(t => GetGroupKey(t.Date, granularity) == GetGroupKey(d, granularity)),
                NewExceptions = exceptionNewTask.Result.Count(e => GetGroupKey(e.Date, granularity) == GetGroupKey(d, granularity)),
                ResolvedExceptions = exceptionResolvedTask.Result.Count(e => GetGroupKey(e.Date, granularity) == GetGroupKey(d, granularity))
            });
        }

        return ApiResponse<List<DailyStatisticsDto>>.Success(result);
    }

    private static List<DateTime> GetDateRange(DateTime start, DateTime end, string granularity)
    {
        var dates = new List<DateTime>();
        switch (granularity)
        {
            case "week":
                var firstMonday = start.AddDays(-(int)start.DayOfWeek + (int)DayOfWeek.Monday);
                for (var d = firstMonday; d <= end; d = d.AddDays(7))
                    dates.Add(d);
                break;
            case "month":
                var firstMonth = new DateTime(start.Year, start.Month, 1);
                while (firstMonth <= end)
                {
                    dates.Add(firstMonth);
                    firstMonth = firstMonth.AddMonths(1);
                }
                break;
            case "quarter":
                var firstQuarter = new DateTime(start.Year, ((start.Month - 1) / 3) * 3 + 1, 1);
                while (firstQuarter <= end)
                {
                    dates.Add(firstQuarter);
                    firstQuarter = firstQuarter.AddMonths(3);
                }
                break;
            case "year":
                var firstYear = new DateTime(start.Year, 1, 1);
                while (firstYear <= end)
                {
                    dates.Add(firstYear);
                    firstYear = firstYear.AddYears(1);
                }
                break;
            default:
                for (var d = start.Date; d <= end.Date; d = d.AddDays(1))
                    dates.Add(d);
                break;
        }
        return dates;
    }

    private static DateTime GetGroupKey(DateTime date, string granularity)
    {
        switch (granularity)
        {
            case "week":
                return date.AddDays(-(int)date.DayOfWeek + (int)DayOfWeek.Monday).Date;
            case "month":
                return new DateTime(date.Year, date.Month, 1);
            case "quarter":
                return new DateTime(date.Year, ((date.Month - 1) / 3) * 3 + 1, 1);
            case "year":
                return new DateTime(date.Year, 1, 1);
            default:
                return date.Date;
        }
    }

    public async Task<ApiResponse<WeeklyMonthlyReportDto>> GetWeeklyMonthlyReportAsync(StatisticsQueryDto dto, string reportType = "weekly")
    {
        _logger.LogInformation("Generating {ReportType} report: {Start} to {End}", reportType, dto.StartDate, dto.EndDate);

        var txnStatsTask = GetTransactionStatisticsAsync(dto);
        var brandStatsTask = GetBrandStatisticsAsync(dto);
        var gradeStatsTask = GetInspectionGradeStatisticsAsync(dto);
        var workflowTask = GetWorkflowTimelinessAsync(dto);
        var exceptionTask = GetExceptionCaseStatisticsAsync(dto);
        var dailyTask = GetDailyTrendAsync(dto);

        await Task.WhenAll(txnStatsTask, brandStatsTask, gradeStatsTask, workflowTask, exceptionTask, dailyTask);

        var gradeList = gradeStatsTask.Result.Data ?? new List<InspectionGradeStatisticsDto>();
        var gradeSummary = new InspectionGradeStatisticsDto
        {
            Grade = null,
            GradeName = "综合",
            Count = gradeList.Sum(g => g.Count),
            Percentage = 100,
            AverageScore = gradeList.Any(g => g.Count > 0)
                ? Math.Round(gradeList.Where(g => g.Count > 0).Average(g => g.AverageScore), 2)
                : 0
        };

        var report = new WeeklyMonthlyReportDto
        {
            ReportStartDate = dto.StartDate,
            ReportEndDate = dto.EndDate,
            ReportType = reportType,
            TransactionSummary = txnStatsTask.Result.Data ?? new TransactionStatisticsDto(),
            BrandDistribution = brandStatsTask.Result.Data ?? new List<BrandStatisticsDto>(),
            GradeSummary = gradeSummary,
            GradeDistribution = gradeList,
            WorkflowTimeliness = workflowTask.Result.Data,
            ExceptionSummary = exceptionTask.Result.Data,
            DailyTrend = dailyTask.Result.Data ?? new List<DailyStatisticsDto>()
        };

        return ApiResponse<WeeklyMonthlyReportDto>.Success(report,
            $"{(reportType == "weekly" ? "周报" : "月报")}生成成功",
            $"{reportType} report generated successfully");
    }
}
