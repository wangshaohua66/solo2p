namespace FireIoTPlatform.Models.DTOs.Statistics;

public class StatisticsQueryDto
{
    public string? DistrictCode { get; set; }
    public long? FireUnitId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? GroupBy { get; set; }
}

public class DashboardOverviewDto
{
    public int TotalUnitCount { get; set; }
    public int TotalDeviceCount { get; set; }
    public int OnlineDeviceCount { get; set; }
    public double DeviceOnlineRate { get; set; }
    public int TodayAlarmCount { get; set; }
    public int PendingAlarmCount { get; set; }
    public int TodayInspectionCount { get; set; }
    public int PendingHazardCount { get; set; }
    public int ActiveDispatchCount { get; set; }
    public int OverdueHazardCount { get; set; }
}

public class AlarmTrendDto
{
    public DateTime Date { get; set; }
    public int TotalCount { get; set; }
    public int SmokeCount { get; set; }
    public int TemperatureCount { get; set; }
    public int WaterPressureCount { get; set; }
    public int DeviceFaultCount { get; set; }
    public int FalseAlarmCount { get; set; }
}

public class FailureRateByTypeDto
{
    public DeviceType DeviceType { get; set; }
    public string DeviceTypeName { get; set; } = string.Empty;
    public int DeviceCount { get; set; }
    public int FailureCount { get; set; }
    public double FailureRate { get; set; }
}

public class AlarmHandleEfficiencyDto
{
    public string DistrictName { get; set; } = string.Empty;
    public int TotalAlarmCount { get; set; }
    public int ResolvedCount { get; set; }
    public double AverageResponseSeconds { get; set; }
    public double AverageResolveMinutes { get; set; }
    public double ResolutionRate { get; set; }
}

public class InspectionCompletionRateDto
{
    public string DistrictName { get; set; } = string.Empty;
    public int TotalTaskCount { get; set; }
    public int CompletedCount { get; set; }
    public int OverdueCount { get; set; }
    public double CompletionRate { get; set; }
}

public class UnitTypeStatisticsDto
{
    public UnitType UnitType { get; set; }
    public string UnitTypeName { get; set; } = string.Empty;
    public int UnitCount { get; set; }
    public int DeviceCount { get; set; }
    public int AlarmCount { get; set; }
    public int HazardCount { get; set; }
}

public class MonthlySafetyReportDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string? DistrictCode { get; set; }
    public string? DistrictName { get; set; }
    public int TotalUnitCount { get; set; }
    public int TotalDeviceCount { get; set; }
    public double DeviceOnlineRate { get; set; }
    public int TotalAlarmCount { get; set; }
    public int FalseAlarmCount { get; set; }
    public double FalseAlarmRate { get; set; }
    public double AverageAlarmResponseSeconds { get; set; }
    public int TotalInspectionTaskCount { get; set; }
    public int CompletedInspectionCount { get; set; }
    public double InspectionCompletionRate { get; set; }
    public int TotalHazardCount { get; set; }
    public int ResolvedHazardCount { get; set; }
    public double HazardResolutionRate { get; set; }
    public int TotalDispatchCount { get; set; }
    public int RescueDispatchCount { get; set; }
    public List<FailureRateByTypeDto> FailureRateByTypes { get; set; } = new();
    public string? Summary { get; set; }
    public string? Recommendations { get; set; }
}
