using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ColdChainMonitor.Application.Services;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class QualityController : ControllerBase
{
    private readonly QualityService _qualityService;
    private readonly TransportService _transportService;
    private readonly AuditService _auditService;

    public QualityController(
        QualityService qualityService,
        TransportService transportService,
        AuditService auditService)
    {
        _qualityService = qualityService;
        _transportService = transportService;
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<ApiResponse<CursorPagedResult<QualityReportDto>>> GetReports(
        [FromQuery] QualityResult? result,
        [FromQuery] string? keyword,
        [FromQuery] string? taskNo,
        [FromQuery] string? inspectorId,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        [FromQuery] bool sortDesc = true)
    {
        var request = new QualityReportQueryRequest
        {
            Result = result,
            Keyword = keyword,
            TaskNo = taskNo,
            InspectorId = inspectorId,
            StartTime = startTime,
            EndTime = endTime,
            Cursor = cursor,
            Limit = limit,
            SortDesc = sortDesc
        };

        var resultPage = await _qualityService.GetPagedAsync(request);
        return ApiResponse<CursorPagedResult<QualityReportDto>>.Success(resultPage);
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<QualityReportDto>> GetById(string id)
    {
        var report = await _qualityService.GetByIdAsync(id);
        if (report == null)
        {
            return ApiResponse<QualityReportDto>.Error(5001, "质检报告不存在");
        }
        return ApiResponse<QualityReportDto>.Success(report);
    }

    [HttpGet("reportNo/{reportNo}")]
    public async Task<ApiResponse<QualityReportDto>> GetByReportNo(string reportNo)
    {
        var report = await _qualityService.GetByReportNoAsync(reportNo);
        if (report == null)
        {
            return ApiResponse<QualityReportDto>.Error(5001, "质检报告不存在");
        }
        return ApiResponse<QualityReportDto>.Success(report);
    }

    [HttpGet("task/{taskId}")]
    public async Task<ApiResponse<QualityReportDto>> GetByTaskId(string taskId)
    {
        var report = await _qualityService.GetByTaskIdAsync(taskId);
        if (report == null)
        {
            return ApiResponse<QualityReportDto>.Error(5001, "质检报告不存在");
        }
        return ApiResponse<QualityReportDto>.Success(report);
    }

    [HttpPost("generate/{taskId}")]
    [Authorize(Roles = "QualityInspector,Admin")]
    public async Task<ApiResponse<QualityReportDto>> GenerateReport(string taskId)
    {
        var inspectorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var inspectorName = User.FindFirst("realName")?.Value;

        try
        {
            var report = await _qualityService.CreateReportAsync(taskId, inspectorId!, inspectorName!);

            await _transportService.StartQualityCheckAsync(taskId, inspectorId!, inspectorName!, "生成质检报告");

            return ApiResponse<QualityReportDto>.Success(report, "质检报告生成成功");
        }
        catch (ArgumentException ex)
        {
            return ApiResponse<QualityReportDto>.Error(5002, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiResponse<QualityReportDto>.Error(5003, ex.Message);
        }
    }

    [HttpPost("check")]
    [Authorize(Roles = "QualityInspector,Admin")]
    public async Task<ApiResponse<QualityReportDto>> SubmitQualityCheck([FromBody] QualityCheckRequest request)
    {
        var inspectorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var inspectorName = User.FindFirst("realName")?.Value;

        try
        {
            var report = await _qualityService.SubmitQualityCheckAsync(request, inspectorId!, inspectorName!);
            return ApiResponse<QualityReportDto>.Success(report, "质检结果提交成功");
        }
        catch (ArgumentException ex)
        {
            return ApiResponse<QualityReportDto>.Error(5001, ex.Message);
        }
    }
}
