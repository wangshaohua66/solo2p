using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Background;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportController : BaseController
{
    private readonly IReportService _service;
    private readonly IExportService _exportService;

    public ReportController(IReportService service, IExportService exportService)
    {
        _service = service;
        _exportService = exportService;
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

    [HttpGet("export/production-trend")]
    public async Task<IActionResult> ExportProductionTrend(
        [FromQuery] ReportQueryDto query,
        [FromQuery] string format = "xlsx")
    {
        var data = await _service.GetProductionTrendAsync(query);
        var fileName = $"产量趋势_{DateTime.Now:yyyyMMddHHmmss}";
        return ExportInternal(format, fileName,
            () => _exportService.ExportProductionTrendToExcel(data),
            () => _exportService.ExportProductionTrendToCsv(data));
    }

    [HttpGet("export/fee-collection")]
    public async Task<IActionResult> ExportFeeCollection(
        [FromQuery] ReportQueryDto query,
        [FromQuery] string format = "xlsx")
    {
        var data = await _service.GetFeeCollectionAsync(query);
        var fileName = $"费款入库_{DateTime.Now:yyyyMMddHHmmss}";
        return ExportInternal(format, fileName,
            () => _exportService.ExportFeeCollectionToExcel(data),
            () => _exportService.ExportFeeCollectionToCsv(data));
    }

    [HttpGet("export/safety-disposal")]
    public async Task<IActionResult> ExportSafetyDisposal(
        [FromQuery] ReportQueryDto query,
        [FromQuery] string format = "xlsx")
    {
        var data = await _service.GetSafetyDisposalStatsAsync(query);
        var fileName = $"预警处置_{DateTime.Now:yyyyMMddHHmmss}";
        return ExportInternal(format, fileName,
            () => _exportService.ExportSafetyDisposalToExcel(data),
            () => _exportService.ExportSafetyDisposalToCsv(data));
    }

    [HttpGet("export/expiring-rights")]
    public async Task<IActionResult> ExportExpiringMiningRights(
        [FromQuery] int daysAhead = 90,
        [FromQuery] string format = "xlsx")
    {
        var data = await _service.GetExpiringMiningRightsAsync(daysAhead);
        var fileName = $"到期预警_{DateTime.Now:yyyyMMddHHmmss}";
        return ExportInternal(format, fileName,
            () => _exportService.ExportMiningRightExpiryToExcel(data),
            () => _exportService.ExportMiningRightExpiryToCsv(data));
    }

    [HttpGet("export/mine-stats")]
    public async Task<IActionResult> ExportMineStats(
        [FromQuery] ReportQueryDto query,
        [FromQuery] string format = "xlsx")
    {
        var data = await _service.GetMineStatsAsync(query);
        var fileName = $"矿山概览_{DateTime.Now:yyyyMMddHHmmss}";
        return ExportInternal(format, fileName,
            () => _exportService.ExportMineStatsToExcel(data),
            () => _exportService.ExportMineStatsToCsv(data));
    }

    private FileResult ExportInternal(
        string format,
        string fileName,
        Func<byte[]> excelFactory,
        Func<byte[]> csvFactory)
    {
        bool isExcel = string.Equals(format, "xlsx", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(format, "excel", StringComparison.OrdinalIgnoreCase);

        if (isExcel)
        {
            var bytes = excelFactory();
            return File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName + ".xlsx");
        }
        else
        {
            var bytes = csvFactory();
            return File(bytes, "text/csv; charset=utf-8", fileName + ".csv");
        }
    }
}
