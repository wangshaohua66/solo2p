using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportController : BaseController
{
    private readonly IReportService _service;

    public ReportController(IReportService service)
    {
        _service = service;
    }

    [HttpGet("production-trend")]
    public async Task<IActionResult> GetProductionTrend([FromQuery] ReportQueryDto query)
    {
        var result = await _service.GetProductionTrendAsync(query);
        return Success(result);
    }

    [HttpGet("fee-collection")]
    public async Task<IActionResult> GetFeeCollection([FromQuery] ReportQueryDto query)
    {
        var result = await _service.GetFeeCollectionAsync(query);
        return Success(result);
    }

    [HttpGet("safety-disposal")]
    public async Task<IActionResult> GetSafetyDisposalStats([FromQuery] ReportQueryDto query)
    {
        var result = await _service.GetSafetyDisposalStatsAsync(query);
        return Success(result);
    }

    [HttpGet("expiring-rights")]
    public async Task<IActionResult> GetExpiringMiningRights([FromQuery] int daysAhead = 90)
    {
        var result = await _service.GetExpiringMiningRightsAsync(daysAhead);
        return Success(result);
    }

    [HttpGet("mine-stats")]
    public async Task<IActionResult> GetMineStats([FromQuery] ReportQueryDto query)
    {
        var result = await _service.GetMineStatsAsync(query);
        return Success(result);
    }

    [HttpPost("process-overdue")]
    [Authorize(Roles = "MiningApprover")]
    public async Task<IActionResult> ProcessOverdueFees()
    {
        await _service.ProcessOverdueFeesAsync();
        return Success("逾期费款处理完成");
    }
}
