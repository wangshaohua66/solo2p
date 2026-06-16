using Microsoft.AspNetCore.Mvc;
using Serilog;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ReportController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportController(IReportService reportService)
    {
        _reportService = reportService;
    }

    /// <summary>
    /// 生成合规报告
    /// </summary>
    /// <remarks>
    /// 按需生成符合GSP规范的温控合规报告，包含超限事件汇总、统计图表数据、原始采样明细。
    /// </remarks>
    /// <param name="request">报告生成请求</param>
    /// <returns>报告信息</returns>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiResponse<ReportDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<ReportDto>>> Generate([FromBody] ReportGenerateRequest request)
    {
        Log.Information("生成报告: CustomerId={CustomerId}, ShipmentId={ShipmentId}, Type={ReportType}",
            request.CustomerId, request.ShipmentId, request.ReportType);

        var result = await _reportService.GenerateReportAsync(request);

        return Ok(new ApiResponse<ReportDto>
        {
            Code = 0,
            Message = "报告生成成功",
            Data = result
        });
    }

    /// <summary>
    /// 分页查询报告列表
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ReportDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<ReportDto>>>> GetPaged(
        [FromQuery] ReportQueryRequest request)
    {
        var result = await _reportService.GetPagedAsync(request);

        return Ok(new ApiResponse<PagedResult<ReportDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 获取报告详情
    /// </summary>
    /// <param name="id">报告ID</param>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ReportDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<ReportDto>>> GetById(long id)
    {
        var result = await _reportService.GetByIdAsync(id);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "报告不存在"
            });
        }

        return Ok(new ApiResponse<ReportDto>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 下载报告PDF文件
    /// </summary>
    /// <param name="id">报告ID</param>
    [HttpGet("{id}/download")]
    [Produces("application/pdf")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(long id)
    {
        Log.Information("下载报告: ReportId={Id}", id);

        try
        {
            var report = await _reportService.GetByIdAsync(id);
            if (report == null)
            {
                return NotFound(new ApiResponse
                {
                    Code = 404,
                    Message = "报告不存在"
                });
            }

            var fileBytes = await _reportService.DownloadReportAsync(id);
            var fileName = report.FileName ?? $"{report.ReportNumber}.pdf";

            return File(fileBytes, "application/pdf", fileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "报告文件不存在"
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse
            {
                Code = 400,
                Message = ex.Message
            });
        }
    }
}
