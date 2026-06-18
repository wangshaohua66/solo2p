using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "Supervisor")]
[SwaggerTag("报表管理 - 合规报告、统计报表导出")]
public class ReportController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("compliance")]
    [SwaggerOperation(Summary = "获取合规报告", Description = "按月汇总企业库存变动、运输记录、隐患整改进度，生成符合国标格式的监管报表")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<ComplianceReportDto>))]
    public async Task<ActionResult<ApiResponse<ComplianceReportDto>>> GetComplianceReport(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int? enterpriseId = null)
    {
        var result = await _reportService.GetComplianceReportAsync(new ReportQueryDto
        {
            Year = year,
            Month = month,
            EnterpriseId = enterpriseId
        });
        return Ok(new ApiResponse<ComplianceReportDto> { Data = result });
    }

    [HttpGet("compliance/export")]
    [SwaggerOperation(Summary = "导出合规报告", Description = "导出符合国标格式的月度监管报表（文本格式）")]
    [SwaggerResponse(200, "导出成功", typeof(FileResult))]
    public async Task<IActionResult> ExportComplianceReport(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int? enterpriseId = null)
    {
        var result = await _reportService.ExportComplianceReportAsync(new ReportQueryDto
        {
            Year = year,
            Month = month,
            EnterpriseId = enterpriseId
        });
        var fileName = $"合规报告_{year}年{month}月_{DateTime.UtcNow:yyyyMMddHHmmss}.txt";
        return File(result, "text/plain; charset=utf-8", fileName);
    }

    [HttpGet("inventory/export")]
    [SwaggerOperation(Summary = "导出库存报表", Description = "导出库存统计报表")]
    [SwaggerResponse(200, "导出成功", typeof(FileResult))]
    public async Task<IActionResult> ExportInventoryReport(
        [FromQuery] int? enterpriseId = null,
        [FromQuery] int? warehouseId = null,
        [FromQuery] int? category = null)
    {
        var result = await _reportService.ExportInventoryReportAsync(enterpriseId, warehouseId, category);
        var fileName = $"库存报表_{DateTime.UtcNow:yyyyMMddHHmmss}.txt";
        return File(result, "text/plain; charset=utf-8", fileName);
    }

    [HttpGet("transport/export")]
    [SwaggerOperation(Summary = "导出运输报表", Description = "导出运输记录报表")]
    [SwaggerResponse(200, "导出成功", typeof(FileResult))]
    public async Task<IActionResult> ExportTransportReport(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? enterpriseId = null)
    {
        var result = await _reportService.ExportTransportReportAsync(
            new DateRangeFilter { StartDate = startDate, EndDate = endDate },
            enterpriseId);
        var fileName = $"运输报表_{DateTime.UtcNow:yyyyMMddHHmmss}.txt";
        return File(result, "text/plain; charset=utf-8", fileName);
    }

    [HttpGet("hazard/export")]
    [SwaggerOperation(Summary = "导出隐患报表", Description = "导出隐患整改报表")]
    [SwaggerResponse(200, "导出成功", typeof(FileResult))]
    public async Task<IActionResult> ExportHazardReport(
        [FromQuery] int? enterpriseId = null,
        [FromQuery] int? status = null)
    {
        var result = await _reportService.ExportHazardReportAsync(enterpriseId, status);
        var fileName = $"隐患报表_{DateTime.UtcNow:yyyyMMddHHmmss}.txt";
        return File(result, "text/plain; charset=utf-8", fileName);
    }

    [HttpGet("drill/export")]
    [SwaggerOperation(Summary = "导出演练报表", Description = "导出应急演练报表")]
    [SwaggerResponse(200, "导出成功", typeof(FileResult))]
    public async Task<IActionResult> ExportDrillReport(
        [FromQuery] int year,
        [FromQuery] int? quarter = null,
        [FromQuery] int? enterpriseId = null)
    {
        var result = await _reportService.ExportDrillReportAsync(year, quarter, enterpriseId);
        var fileName = $"演练报表_{year}年_{DateTime.UtcNow:yyyyMMddHHmmss}.txt";
        return File(result, "text/plain; charset=utf-8", fileName);
    }
}
