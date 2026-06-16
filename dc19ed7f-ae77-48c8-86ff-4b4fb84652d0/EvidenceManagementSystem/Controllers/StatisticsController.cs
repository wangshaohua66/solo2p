using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/statistics")]
[Produces("application/json")]
[Authorize]
public class StatisticsController : BaseController
{
    private readonly IStatisticsService _statisticsService;
    private readonly ILogger<StatisticsController> _logger;

    public StatisticsController(IStatisticsService statisticsService, ILogger<StatisticsController> logger)
    {
        _statisticsService = statisticsService;
        _logger = logger;
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview([FromQuery] StatisticsQuery query)
    {
        var result = await _statisticsService.GetOverviewAsync(query);
        return Success(result);
    }

    [HttpGet("category")]
    public async Task<IActionResult> GetCategoryStatistics([FromQuery] StatisticsQuery query)
    {
        var result = await _statisticsService.GetCategoryStatisticsAsync(query);
        return Success(result);
    }

    [HttpGet("department")]
    public async Task<IActionResult> GetDepartmentStatistics([FromQuery] StatisticsQuery query)
    {
        var result = await _statisticsService.GetDepartmentStatisticsAsync(query);
        return Success(result);
    }

    [HttpGet("daily")]
    public async Task<IActionResult> GetDailyStatistics([FromQuery] StatisticsQuery query)
    {
        var result = await _statisticsService.GetDailyStatisticsAsync(query);
        return Success(result);
    }
}
