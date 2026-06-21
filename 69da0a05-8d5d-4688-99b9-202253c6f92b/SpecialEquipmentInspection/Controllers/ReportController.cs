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
    public async Task<IActionResult> Export(int id, [FromQuery] string format = "html")
    {
        var (content, fileName, mimeType) = await _service.ExportReportAsync(id, format);
        return File(content, mimeType, fileName);
    }

    [HttpGet("statistics")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<InspectionStatistics>> Statistics([FromQuery] int? year, [FromQuery] string? region)
    {
        var stats = await _service.GetStatisticsAsync(year, region);
        return ApiResponse<InspectionStatistics>.Ok(stats);
    }

    [HttpGet("statistics/time-series")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<TimeSeriesStatistics>> TimeSeries(
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        [FromQuery] TimeDimension dimension = TimeDimension.Month,
        [FromQuery] string? region = null,
        [FromQuery] DeviceType? deviceType = null)
    {
        if (dateFrom >= dateTo)
            throw new BusinessException("开始日期必须早于结束日期");

        var stats = await _service.GetTimeSeriesStatisticsAsync(dateFrom, dateTo, dimension, region, deviceType);
        return ApiResponse<TimeSeriesStatistics>.Ok(stats);
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

    [HttpPost("supervision/{id:int}/submit")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<SupervisionReport>> SubmitSupervision(int id)
    {
        var report = await _service.SubmitToSupervisionAsync(id, _user.User)
            ?? throw new NotFoundException("监察上报记录不存在");
        return ApiResponse<SupervisionReport>.Ok(report,
            report.Status == SupervisionReportStatus.Reported ? "省级监察平台上报成功" : "省级监察平台上报失败");
    }

    [HttpPost("alerts/run")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> RunAlerts()
    {
        var handled = await _alertService.RunAllAsync();
        return ApiResponse.Ok(new { handled }, $"预警检查完成，处理 {handled} 条超期整改");
    }
}
