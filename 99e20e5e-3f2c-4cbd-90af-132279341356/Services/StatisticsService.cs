using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Statistics;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<StatisticsService> _logger;

    public StatisticsService(IUnitOfWork unitOfWork, ILogger<StatisticsService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ApiResponse<DashboardOverviewDto>> GetDashboardOverviewAsync(string? districtCode = null)
    {
        var unitPredicate = PredicateBuilder.True<FireUnit>().And(u => !u.IsDeleted);
        var devicePredicate = PredicateBuilder.True<Device>().And(d => !d.IsDeleted);
        var alarmPredicate = PredicateBuilder.True<AlarmRecord>().And(a => !a.IsDeleted && a.AlarmTime >= DateTime.Today);
        var hazardPredicate = PredicateBuilder.True<HazardRecord>().And(h => !h.IsDeleted);
        var dispatchPredicate = PredicateBuilder.True<RescueDispatch>().And(d => !d.IsDeleted &&
            d.Status != DispatchStatus.Resolved && d.Status != DispatchStatus.Returned);

        if (!string.IsNullOrEmpty(districtCode))
        {
            unitPredicate = unitPredicate.And(u => u.DistrictCode == districtCode);
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode)).Select(u => u.Id).ToList();
            if (unitIds.Any())
            {
                devicePredicate = devicePredicate.And(d => unitIds.Contains(d.FireUnitId));
                alarmPredicate = alarmPredicate.And(a => unitIds.Contains(a.FireUnitId));
                hazardPredicate = hazardPredicate.And(h => unitIds.Contains(h.FireUnitId));
                dispatchPredicate = dispatchPredicate.And(d => unitIds.Contains(d.FireUnitId));
            }
        }

        var totalUnits = await _unitOfWork.FireUnits.CountAsync(unitPredicate);
        var devices = await _unitOfWork.Devices.FindAsync(devicePredicate);
        var alarms = await _unitOfWork.AlarmRecords.FindAsync(alarmPredicate);
        var pendingAlarms = await _unitOfWork.AlarmRecords.FindAsync(PredicateBuilder.True<AlarmRecord>()
            .And(a => !a.IsDeleted && a.Status == AlarmStatus.Pending));
        var todayInsp = await _unitOfWork.InspectionTasks.CountAsync(PredicateBuilder.True<InspectionTask>()
            .And(t => !t.IsDeleted && t.PlanStartDate >= DateTime.Today));
        var hazards = await _unitOfWork.HazardRecords.FindAsync(hazardPredicate);
        var activeDispatches = await _unitOfWork.RescueDispatches.CountAsync(dispatchPredicate);

        var overview = new DashboardOverviewDto
        {
            TotalUnitCount = totalUnits,
            TotalDeviceCount = devices.Count(),
            OnlineDeviceCount = devices.Count(d => d.Status == DeviceStatus.Online),
            DeviceOnlineRate = devices.Any() ? Math.Round((double)devices.Count(d => d.Status == DeviceStatus.Online) / devices.Count() * 100, 2) : 0,
            TodayAlarmCount = alarms.Count(),
            PendingAlarmCount = pendingAlarms.Count(),
            TodayInspectionCount = todayInsp,
            PendingHazardCount = hazards.Count(h => h.Status is HazardStatus.Registered or HazardStatus.Rectifying),
            ActiveDispatchCount = activeDispatches,
            OverdueHazardCount = hazards.Count(h => h.IsOverdue)
        };

        return ApiResponse<DashboardOverviewDto>.Success(overview);
    }

    public async Task<ApiResponse<List<AlarmTrendDto>>> GetAlarmTrendAsync(StatisticsQueryDto query)
    {
        var startDate = query.StartDate ?? DateTime.Now.AddDays(-30);
        var endDate = query.EndDate ?? DateTime.Now;

        var predicate = PredicateBuilder.True<AlarmRecord>()
            .And(a => !a.IsDeleted && a.AlarmTime >= startDate && a.AlarmTime <= endDate);

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(a => unitIds.Contains(a.FireUnitId));
        }
        if (query.FireUnitId.HasValue) predicate = predicate.And(a => a.FireUnitId == query.FireUnitId.Value);

        var alarms = await _unitOfWork.AlarmRecords.FindAsync(predicate);
        var result = new List<AlarmTrendDto>();

        for (var day = startDate.Date; day <= endDate.Date; day = day.AddDays(1))
        {
            var dayAlarms = alarms.Where(a => a.AlarmTime.Date == day).ToList();
            result.Add(new AlarmTrendDto
            {
                Date = day,
                TotalCount = dayAlarms.Count,
                SmokeCount = dayAlarms.Count(a => a.AlarmType == AlarmType.SmokeAlarm),
                TemperatureCount = dayAlarms.Count(a => a.AlarmType == AlarmType.TemperatureAlarm),
                WaterPressureCount = dayAlarms.Count(a => a.AlarmType is AlarmType.WaterPressureLow or AlarmType.WaterLevelLow),
                DeviceFaultCount = dayAlarms.Count(a => a.AlarmType is AlarmType.DeviceFault or AlarmType.DeviceOffline),
                FalseAlarmCount = dayAlarms.Count(a => a.IsFalseAlarm)
            });
        }

        return ApiResponse<List<AlarmTrendDto>>.Success(result);
    }

    public async Task<ApiResponse<List<FailureRateByTypeDto>>> GetFailureRateByDeviceTypeAsync(StatisticsQueryDto query)
    {
        var deviceTypes = Enum.GetValues(typeof(DeviceType)).Cast<DeviceType>().ToList();
        var result = new List<FailureRateByTypeDto>();

        foreach (var type in deviceTypes)
        {
            var devices = await _unitOfWork.Devices.FindAsync(d => !d.IsDeleted && d.DeviceType == type);
            var totalCount = devices.Count();
            if (totalCount == 0) continue;

            var predicate = PredicateBuilder.True<AlarmRecord>()
                .And(a => !a.IsDeleted && a.Status != AlarmStatus.FalseAlarm);
            if (query.StartDate.HasValue) predicate = predicate.And(a => a.AlarmTime >= query.StartDate.Value);
            if (query.EndDate.HasValue) predicate = predicate.And(a => a.AlarmTime <= query.EndDate.Value);

            var deviceIds = devices.Select(d => d.Id).ToList();
            predicate = predicate.And(a => deviceIds.Contains(a.DeviceId));
            var failureCount = await _unitOfWork.AlarmRecords.CountAsync(predicate);

            result.Add(new FailureRateByTypeDto
            {
                DeviceType = type,
                DeviceTypeName = GetDeviceTypeName(type),
                DeviceCount = totalCount,
                FailureCount = failureCount,
                FailureRate = Math.Round((double)failureCount / totalCount * 100, 2)
            });
        }

        return ApiResponse<List<FailureRateByTypeDto>>.Success(result.OrderByDescending(r => r.FailureRate).ToList());
    }

    public async Task<ApiResponse<List<AlarmHandleEfficiencyDto>>> GetAlarmHandleEfficiencyAsync(StatisticsQueryDto query)
    {
        var predicate = PredicateBuilder.True<AlarmRecord>().And(a => !a.IsDeleted);
        if (query.StartDate.HasValue) predicate = predicate.And(a => a.AlarmTime >= query.StartDate.Value);
        if (query.EndDate.HasValue) predicate = predicate.And(a => a.AlarmTime <= query.EndDate.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(a => a.FireUnitId == query.FireUnitId.Value);

        var allAlarms = await _unitOfWork.AlarmRecords.FindAsync(predicate);
        var groupedAlarms = new Dictionary<string, List<AlarmRecord>>();

        foreach (var a in allAlarms)
        {
            var unit = await _unitOfWork.FireUnits.GetByIdAsync(a.FireUnitId);
            var district = unit?.DistrictName ?? "未分类";
            if (!groupedAlarms.ContainsKey(district)) groupedAlarms[district] = new List<AlarmRecord>();
            groupedAlarms[district].Add(a);
        }

        var result = new List<AlarmHandleEfficiencyDto>();
        foreach (var (district, alarms) in groupedAlarms)
        {
            var resolved = alarms.Where(a => a.Status == AlarmStatus.Resolved).ToList();
            var avgResp = resolved.Where(a => a.ConfirmTime.HasValue).Any()
                ? Math.Round(resolved.Where(a => a.ConfirmTime.HasValue).Average(a => (a.ConfirmTime!.Value - a.AlarmTime).TotalSeconds), 0)
                : 0;
            var avgRes = resolved.Where(a => a.ResolveTime.HasValue).Any()
                ? Math.Round(resolved.Where(a => a.ResolveTime.HasValue).Average(a => (a.ResolveTime!.Value - a.AlarmTime).TotalMinutes), 1)
                : 0;

            result.Add(new AlarmHandleEfficiencyDto
            {
                DistrictName = district,
                TotalAlarmCount = alarms.Count,
                ResolvedCount = resolved.Count,
                AverageResponseSeconds = avgResp,
                AverageResolveMinutes = avgRes,
                ResolutionRate = alarms.Any() ? Math.Round((double)resolved.Count / alarms.Count * 100, 2) : 0
            });
        }

        return ApiResponse<List<AlarmHandleEfficiencyDto>>.Success(result);
    }

    public async Task<ApiResponse<List<InspectionCompletionRateDto>>> GetInspectionCompletionRateAsync(StatisticsQueryDto query)
    {
        var predicate = PredicateBuilder.True<InspectionTask>().And(t => !t.IsDeleted);
        if (query.StartDate.HasValue) predicate = predicate.And(t => t.PlanStartDate >= query.StartDate.Value);
        if (query.EndDate.HasValue) predicate = predicate.And(t => t.PlanEndDate <= query.EndDate.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(t => t.FireUnitId == query.FireUnitId.Value);

        var allTasks = await _unitOfWork.InspectionTasks.FindAsync(predicate);
        var groupedTasks = new Dictionary<string, List<InspectionTask>>();

        foreach (var t in allTasks)
        {
            var unit = await _unitOfWork.FireUnits.GetByIdAsync(t.FireUnitId);
            var district = unit?.DistrictName ?? "未分类";
            if (!groupedTasks.ContainsKey(district)) groupedTasks[district] = new List<InspectionTask>();
            groupedTasks[district].Add(t);
        }

        var now = DateTime.Now;
        var result = new List<InspectionCompletionRateDto>();
        foreach (var (district, tasks) in groupedTasks)
        {
            result.Add(new InspectionCompletionRateDto
            {
                DistrictName = district,
                TotalTaskCount = tasks.Count,
                CompletedCount = tasks.Count(t => t.Status == InspectionStatus.Completed),
                OverdueCount = tasks.Count(t => t.Status != InspectionStatus.Completed && t.PlanEndDate < now),
                CompletionRate = tasks.Any() ? Math.Round((double)tasks.Count(t => t.Status == InspectionStatus.Completed) / tasks.Count * 100, 2) : 0
            });
        }

        return ApiResponse<List<InspectionCompletionRateDto>>.Success(result);
    }

    public async Task<ApiResponse<List<UnitTypeStatisticsDto>>> GetUnitTypeStatisticsAsync(StatisticsQueryDto query)
    {
        var unitTypes = Enum.GetValues(typeof(UnitType)).Cast<UnitType>().ToList();
        var result = new List<UnitTypeStatisticsDto>();

        foreach (var type in unitTypes)
        {
            var predicate = PredicateBuilder.True<FireUnit>().And(u => !u.IsDeleted && u.UnitType == type);
            if (!string.IsNullOrEmpty(query.DistrictCode)) predicate = predicate.And(u => u.DistrictCode == query.DistrictCode);
            var units = await _unitOfWork.FireUnits.FindAsync(predicate);
            var unitIds = units.Select(u => u.Id).ToList();

            var deviceCount = units.Any()
                ? await _unitOfWork.Devices.CountAsync(d => !d.IsDeleted && unitIds.Contains(d.FireUnitId))
                : 0;
            var alarmCount = units.Any()
                ? await _unitOfWork.AlarmRecords.CountAsync(a => !a.IsDeleted && unitIds.Contains(a.FireUnitId))
                : 0;
            var hazardCount = units.Any()
                ? await _unitOfWork.HazardRecords.CountAsync(h => !h.IsDeleted && unitIds.Contains(h.FireUnitId))
                : 0;

            result.Add(new UnitTypeStatisticsDto
            {
                UnitType = type,
                UnitTypeName = GetUnitTypeName(type),
                UnitCount = units.Count(),
                DeviceCount = deviceCount,
                AlarmCount = alarmCount,
                HazardCount = hazardCount
            });
        }

        return ApiResponse<List<UnitTypeStatisticsDto>>.Success(result.Where(r => r.UnitCount > 0).ToList());
    }

    public async Task<ApiResponse<MonthlySafetyReportDto>> GenerateMonthlyReportAsync(int year, int month, string? districtCode = null)
    {
        var startDate = new DateTime(year, month, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        var unitPredicate = PredicateBuilder.True<FireUnit>().And(u => !u.IsDeleted);
        var devicePredicate = PredicateBuilder.True<Device>().And(d => !d.IsDeleted);
        var alarmPredicate = PredicateBuilder.True<AlarmRecord>()
            .And(a => !a.IsDeleted && a.AlarmTime >= startDate && a.AlarmTime <= endDate);
        var inspPredicate = PredicateBuilder.True<InspectionTask>()
            .And(t => !t.IsDeleted && t.PlanStartDate >= startDate && t.PlanStartDate <= endDate);
        var hazardPredicate = PredicateBuilder.True<HazardRecord>()
            .And(h => !h.IsDeleted && h.DiscoverTime >= startDate && h.DiscoverTime <= endDate);
        var dispatchPredicate = PredicateBuilder.True<RescueDispatch>()
            .And(d => !d.IsDeleted && d.DispatchTime >= startDate && d.DispatchTime <= endDate);

        if (!string.IsNullOrEmpty(districtCode))
        {
            unitPredicate = unitPredicate.And(u => u.DistrictCode == districtCode);
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode)).Select(u => u.Id).ToList();
            if (unitIds.Any())
            {
                devicePredicate = devicePredicate.And(d => unitIds.Contains(d.FireUnitId));
                alarmPredicate = alarmPredicate.And(a => unitIds.Contains(a.FireUnitId));
                inspPredicate = inspPredicate.And(t => unitIds.Contains(t.FireUnitId));
                hazardPredicate = hazardPredicate.And(h => unitIds.Contains(h.FireUnitId));
                dispatchPredicate = dispatchPredicate.And(d => unitIds.Contains(d.FireUnitId));
            }
        }

        var units = await _unitOfWork.FireUnits.FindAsync(unitPredicate);
        var devices = await _unitOfWork.Devices.FindAsync(devicePredicate);
        var alarms = await _unitOfWork.AlarmRecords.FindAsync(alarmPredicate);
        var tasks = await _unitOfWork.InspectionTasks.FindAsync(inspPredicate);
        var hazards = await _unitOfWork.HazardRecords.FindAsync(hazardPredicate);
        var dispatches = await _unitOfWork.RescueDispatches.FindAsync(dispatchPredicate);

        var failureRates = await GetFailureRateByDeviceTypeAsync(new StatisticsQueryDto
        { StartDate = startDate, EndDate = endDate, DistrictCode = districtCode });

        var district = !string.IsNullOrEmpty(districtCode)
            ? (await _unitOfWork.FireUnits.FirstOrDefaultAsync(u => u.DistrictCode == districtCode))?.DistrictName
            : null;

        var report = new MonthlySafetyReportDto
        {
            Year = year,
            Month = month,
            DistrictCode = districtCode,
            DistrictName = district,
            TotalUnitCount = units.Count(),
            TotalDeviceCount = devices.Count(),
            DeviceOnlineRate = devices.Any() ? Math.Round((double)devices.Count(d => d.Status == DeviceStatus.Online) / devices.Count() * 100, 2) : 0,
            TotalAlarmCount = alarms.Count(),
            FalseAlarmCount = alarms.Count(a => a.IsFalseAlarm),
            FalseAlarmRate = alarms.Any() ? Math.Round((double)alarms.Count(a => a.IsFalseAlarm) / alarms.Count() * 100, 2) : 0,
            AverageAlarmResponseSeconds = alarms.Where(a => a.ConfirmTime.HasValue).Any()
                ? Math.Round(alarms.Where(a => a.ConfirmTime.HasValue).Average(a => (a.ConfirmTime!.Value - a.AlarmTime).TotalSeconds), 0)
                : 0,
            TotalInspectionTaskCount = tasks.Count(),
            CompletedInspectionCount = tasks.Count(t => t.Status == InspectionStatus.Completed),
            InspectionCompletionRate = tasks.Any() ? Math.Round((double)tasks.Count(t => t.Status == InspectionStatus.Completed) / tasks.Count() * 100, 2) : 0,
            TotalHazardCount = hazards.Count(),
            ResolvedHazardCount = hazards.Count(h => h.Status == HazardStatus.Accepted),
            HazardResolutionRate = hazards.Any() ? Math.Round((double)hazards.Count(h => h.Status == HazardStatus.Accepted) / hazards.Count() * 100, 2) : 0,
            TotalDispatchCount = dispatches.Count(),
            RescueDispatchCount = dispatches.Count(d => !string.IsNullOrEmpty(d.FireType) && d.FireType.Contains("火灾")),
            FailureRateByTypes = failureRates.Data ?? new List<FailureRateByTypeDto>()
        };

        report.Summary = GenerateSummary(report);
        report.Recommendations = GenerateRecommendations(report);

        return ApiResponse<MonthlySafetyReportDto>.Success(report);
    }

    private static string GenerateSummary(MonthlySafetyReportDto r)
    {
        return $"本月共监管重点单位{r.TotalUnitCount}家，消防设备{r.TotalDeviceCount}台，设备在线率{r.DeviceOnlineRate}%。" +
               $"发生各类告警{r.TotalAlarmCount}起，其中误报{r.FalseAlarmCount}起，误报率{r.FalseAlarmRate}%。" +
               $"巡检任务完成率{r.InspectionCompletionRate}%，发现隐患{r.TotalHazardCount}个，整改完成率{r.HazardResolutionRate}%。" +
               $"出警救援{r.TotalDispatchCount}次。";
    }

    private static string GenerateRecommendations(MonthlySafetyReportDto r)
    {
        var recs = new List<string>();
        if (r.DeviceOnlineRate < 95) recs.Add("建议加强设备维护，提高设备在线率至95%以上。");
        if (r.FalseAlarmRate > 30) recs.Add("误报率较高，建议检查设备灵敏度并进行现场核实。");
        if (r.InspectionCompletionRate < 90) recs.Add("巡检完成率偏低，建议加强巡检计划执行监督。");
        if (r.HazardResolutionRate < 85) recs.Add("隐患整改率需提升，建议加强隐患整改跟踪与超期升级处理。");
        if (!recs.Any()) recs.Add("本月各项指标运行良好，继续保持现有管理水平。");
        return string.Join(" ", recs);
    }

    private static string GetDeviceTypeName(DeviceType type) => type switch
    {
        DeviceType.SmokeDetector => "独立烟感",
        DeviceType.TemperatureDetector => "温感探测器",
        DeviceType.WaterPressureMonitor => "消防水压监测",
        DeviceType.HydrantStatusMonitor => "消防栓状态监测",
        DeviceType.ElectricalFireMonitor => "电气火灾监控",
        DeviceType.WaterLevelMonitor => "水位监测",
        _ => "未知"
    };

    private static string GetUnitTypeName(UnitType t) => t switch
    {
        UnitType.Commercial => "商业场所",
        UnitType.Residential => "居民住宅",
        UnitType.Industrial => "工业企业",
        UnitType.Government => "政府机关",
        UnitType.Educational => "教育机构",
        UnitType.Medical => "医疗机构",
        UnitType.Other => "其他",
        _ => "未知"
    };
}
