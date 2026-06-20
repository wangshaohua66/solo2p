using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Statistics;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService _statisticsService;

    public StatisticsController(IStatisticsService statisticsService)
    {
        _statisticsService = statisticsService;
    }

    [HttpGet("dashboard")]
    public async Task<ApiResponse<DashboardOverviewDto>> GetDashboardOverview([FromQuery] string? districtCode)
    {
        return await _statisticsService.GetDashboardOverviewAsync(districtCode);
    }

    [HttpGet("alarm-trend")]
    public async Task<ApiResponse<List<AlarmTrendDto>>> GetAlarmTrend([FromQuery] StatisticsQueryDto query)
    {
        return await _statisticsService.GetAlarmTrendAsync(query);
    }

    [HttpGet("failure-rate")]
    public async Task<ApiResponse<List<FailureRateByTypeDto>>> GetFailureRateByDeviceType([FromQuery] StatisticsQueryDto query)
    {
        return await _statisticsService.GetFailureRateByDeviceTypeAsync(query);
    }

    [HttpGet("alarm-efficiency")]
    public async Task<ApiResponse<List<AlarmHandleEfficiencyDto>>> GetAlarmHandleEfficiency([FromQuery] StatisticsQueryDto query)
    {
        return await _statisticsService.GetAlarmHandleEfficiencyAsync(query);
    }

    [HttpGet("inspection-rate")]
    public async Task<ApiResponse<List<InspectionCompletionRateDto>>> GetInspectionCompletionRate([FromQuery] StatisticsQueryDto query)
    {
        return await _statisticsService.GetInspectionCompletionRateAsync(query);
    }

    [HttpGet("unit-type")]
    public async Task<ApiResponse<List<UnitTypeStatisticsDto>>> GetUnitTypeStatistics([FromQuery] StatisticsQueryDto query)
    {
        return await _statisticsService.GetUnitTypeStatisticsAsync(query);
    }

    [HttpGet("monthly-report")]
    public async Task<ApiResponse<MonthlySafetyReportDto>> GenerateMonthlyReport([FromQuery] int year,
        [FromQuery] int month, [FromQuery] string? districtCode)
    {
        return await _statisticsService.GenerateMonthlyReportAsync(year, month, districtCode);
    }
}
