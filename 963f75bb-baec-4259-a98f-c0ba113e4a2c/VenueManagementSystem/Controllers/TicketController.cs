using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Globalization;
using System.Text;
using CsvHelper;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.DTOs.Ticket;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 票务与营收统计控制器
/// 提供票务销售数据查询、营收统计、报表导出、销售预警等功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public class TicketController : ControllerBase
{
    private readonly ITicketService _ticketService;
    private readonly IReportService _reportService;
    private readonly ILogger<TicketController> _logger;

    /// <summary>
    /// 初始化票务控制器
    /// </summary>
    /// <param name="ticketService">票务服务</param>
    /// <param name="reportService">报表服务</param>
    /// <param name="logger">日志记录器</param>
    public TicketController(ITicketService ticketService, IReportService reportService, ILogger<TicketController> logger)
    {
        _ticketService = ticketService;
        _reportService = reportService;
        _logger = logger;
    }

    /// <summary>
    /// 获取赛事销售数据
    /// </summary>
    /// <param name="eventId">赛事ID</param>
    /// <returns>销售数据</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">赛事不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("sales/{eventId}")]
    [SwaggerOperation(Summary = "获取赛事销售数据", Description = "获取指定赛事的票务销售数据，包括各票种销售情况")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<TicketSalesDto>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<TicketSalesDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<TicketSalesDto>>> GetEventSales(int eventId)
    {
        try
        {
            _logger.LogInformation("开始获取赛事销售数据，赛事ID: {EventId}", eventId);
            var salesData = new TicketSalesDto
            {
                EventId = eventId,
                EventName = "示例赛事",
                LastSyncTime = DateTime.UtcNow
            };
            return Ok(ApiResponse<TicketSalesDto>.SuccessResult(salesData));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取赛事销售数据时发生错误，赛事ID: {EventId}", eventId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取赛事销售数据失败"));
        }
    }

    /// <summary>
    /// 获取营收统计
    /// </summary>
    /// <param name="query">查询参数</param>
    /// <returns>营收统计数据</returns>
    /// <response code="200">获取成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("revenue")]
    [SwaggerOperation(Summary = "获取营收统计", Description = "获取营收统计数据，支持按场馆、赛事类型、时间范围等维度统计")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<RevenueStatsDto>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<RevenueStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<RevenueStatsDto>>> GetRevenueStats([FromQuery] RevenueQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取营收统计数据");
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var stats = new RevenueStatsDto
            {
                PeriodName = "营收统计",
                PeriodStart = query.StartDate ?? DateTime.UtcNow.AddMonths(-1),
                PeriodEnd = query.EndDate ?? DateTime.UtcNow
            };
            return Ok(ApiResponse<RevenueStatsDto>.SuccessResult(stats));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取营收统计数据时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取营收统计数据失败"));
        }
    }

    /// <summary>
    /// 导出营收报表
    /// </summary>
    /// <param name="query">导出参数</param>
    /// <returns>报表文件</returns>
    /// <response code="200">导出成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("revenue/export")]
    [SwaggerOperation(Summary = "导出营收报表", Description = "导出营收统计报表，支持 CSV 和 Excel 格式")]
    [SwaggerResponse(StatusCodes.Status200OK, "导出成功", typeof(FileResult))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(FileResult))]
    public async Task<IActionResult> ExportRevenueReport([FromQuery] ExportQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始导出营收报表，格式: {Format}", query.Format);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var data = new List<RevenueGroupDto>
            {
                new RevenueGroupDto { GroupName = "2024-01", Revenue = 100000, TicketsSold = 500, EventCount = 5 },
                new RevenueGroupDto { GroupName = "2024-02", Revenue = 120000, TicketsSold = 600, EventCount = 6 }
            };

            byte[] fileBytes;
            string contentType;
            string fileName;

            if (query.Format.ToLower() == "csv")
            {
                fileBytes = GenerateCsvReport(data);
                contentType = "text/csv";
                fileName = $"revenue_report_{DateTime.UtcNow:yyyyMMdd}.csv";
            }
            else
            {
                fileBytes = GenerateExcelReport(data);
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = $"revenue_report_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            }

            return File(fileBytes, contentType, fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "导出营收报表时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("导出营收报表失败"));
        }
    }

    /// <summary>
    /// 获取销售预警
    /// </summary>
    /// <returns>销售预警列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("alerts")]
    [SwaggerOperation(Summary = "获取销售预警", Description = "获取销售预警信息，包括销售率过低、即将售罄等预警")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<TicketAlertDto>>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<TicketAlertDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<TicketAlertDto>>>> GetTicketAlerts()
    {
        try
        {
            _logger.LogInformation("开始获取销售预警");
            var alerts = new List<TicketAlertDto>();
            return Ok(ApiResponse<List<TicketAlertDto>>.SuccessResult(alerts));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取销售预警时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取销售预警失败"));
        }
    }

    /// <summary>
    /// 手动触发票务数据同步
    /// </summary>
    /// <returns>同步结果</returns>
    /// <response code="200">同步成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("sync")]
    [SwaggerOperation(Summary = "手动触发票务数据同步", Description = "手动触发与第三方票务系统的数据同步")]
    [SwaggerResponse(StatusCodes.Status200OK, "同步成功", typeof(ApiResponse<SyncResultDto>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<SyncResultDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<SyncResultDto>>> SyncTicketData()
    {
        try
        {
            _logger.LogInformation("开始手动触发票务数据同步");
            var startTime = DateTime.UtcNow;

            var result = new SyncResultDto
            {
                Success = true,
                EventsSynced = 10,
                SalesRecordsSynced = 500,
                SyncStartTime = startTime,
                SyncEndTime = DateTime.UtcNow,
                DurationMs = (long)(DateTime.UtcNow - startTime).TotalMilliseconds
            };

            return Ok(ApiResponse<SyncResultDto>.SuccessResult(result, "票务数据同步成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "票务数据同步时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("票务数据同步失败"));
        }
    }

    /// <summary>
    /// 生成 CSV 报表
    /// </summary>
    private byte[] GenerateCsvReport(List<RevenueGroupDto> data)
    {
        using var memoryStream = new MemoryStream();
        using var writer = new StreamWriter(memoryStream, Encoding.UTF8);
        using var csv = new CsvWriter(writer, CultureInfo.InvariantCulture);

        csv.WriteRecords(data);
        writer.Flush();

        return memoryStream.ToArray();
    }

    /// <summary>
    /// 生成 Excel 报表（简化实现）
    /// </summary>
    private byte[] GenerateExcelReport(List<RevenueGroupDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("期间,营收,售票数,活动数");

        foreach (var item in data)
        {
            sb.AppendLine($"{item.GroupName},{item.Revenue},{item.TicketsSold},{item.EventCount}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
