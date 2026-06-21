using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;
using SpecialEquipmentInspection.Services;

namespace SpecialEquipmentInspection.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportController : ControllerBase
{
    private readonly IInspectionService _service;
    private readonly IAlertService _alertService;
    private readonly ICurrentUserAccessor _user;

    public ReportController(IInspectionService service, IAlertService alertService, ICurrentUserAccessor user)
    {
        _service = service;
        _alertService = alertService;
        _user = user;
    }

    [HttpPost("generate/{inspectionId:int}")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<Report>> Generate(int inspectionId)
    {
        var report = await _service.GenerateReportAsync(inspectionId, _user.User);
        return ApiResponse<Report>.Ok(report, "检验报告已生成");
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<PagedResult<Report>>> GetReports(
        [FromQuery] ReportStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _service.GetReportsAsync(status, page, pageSize);
        return ApiResponse<PagedResult<Report>>.Ok(data);
    }

    [HttpGet("{id:int}")]
    public async Task<ApiResponse<Report>> GetReport(int id)
    {
        var report = await _service.GetReportAsync(id) ?? throw new NotFoundException("报告不存在");
        return ApiResponse<Report>.Ok(report);
    }

    [HttpGet("by-inspection/{inspectionId:int}")]
    public async Task<ApiResponse<Report?>> GetByInspection(int inspectionId)
    {
        var report = await _service.GetReportByInspectionAsync(inspectionId);
        return ApiResponse<Report?>.Ok(report);
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Report>> Approve(int id, [FromBody] ApproveReportDto dto)
    {
        var report = await _service.ApproveReportAsync(id, dto, _user.User);
        return ApiResponse<Report>.Ok(report, dto.Action == 1 ? "报告审批通过并完成电子签章" : "报告已驳回");
    }

    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> Export(int id)
    {
        var (content, fileName) = await _service.ExportReportAsync(id);
        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        return File(bytes, "text/html; charset=utf-8", fileName);
    }

    [HttpGet("statistics")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<InspectionStatistics>> Statistics([FromQuery] int? year, [FromQuery] string? region)
    {
        var stats = await _service.GetStatisticsAsync(year, region);
        return ApiResponse<InspectionStatistics>.Ok(stats);
    }

    [HttpPost("supervision")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<List<SupervisionReport>>> GenerateSupervision([FromQuery] bool fullSync = false)
    {
        var reports = await _service.GenerateSupervisionReportsAsync(fullSync, _user.User);
        return ApiResponse<List<SupervisionReport>>.Ok(reports, $"已生成 {reports.Count} 条监察上报数据");
    }

    [HttpGet("supervision")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<PagedResult<SupervisionReport>>> GetSupervision(
        [FromQuery] SupervisionReportStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _service.GetSupervisionReportsAsync(status, page, pageSize);
        return ApiResponse<PagedResult<SupervisionReport>>.Ok(data);
    }

    [HttpPost("alerts/run")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> RunAlerts()
    {
        var handled = await _alertService.RunAllAsync();
        return ApiResponse.Ok(new { handled }, $"预警检查完成，处理 {handled} 条超期整改");
    }
}
