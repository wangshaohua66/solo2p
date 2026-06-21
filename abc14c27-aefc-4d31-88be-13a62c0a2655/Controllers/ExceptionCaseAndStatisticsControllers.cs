using Microsoft.AspNetCore.Mvc;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Services;

namespace UsedVehicleTransaction.Controllers;

/// <summary>
/// 异常案件管理控制器
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ExceptionCaseController : ControllerBase
{
    private readonly IExceptionCaseService _exceptionCaseService;
    private readonly ILogger<ExceptionCaseController> _logger;

    public ExceptionCaseController(
        IExceptionCaseService exceptionCaseService,
        ILogger<ExceptionCaseController> logger)
    {
        _exceptionCaseService = exceptionCaseService;
        _logger = logger;
    }

    /// <summary>
    /// 创建异常案件
    /// </summary>
    /// <remarks>
    /// 登记抵押解除异常、查封待解、环保超标待整改等特殊情况，建立跟踪台账
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ExceptionCaseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create([FromBody] ExceptionCaseCreateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _exceptionCaseService.CreateAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 处理异常案件
    /// </summary>
    /// <remarks>记录案件处理过程与结果，支持状态流转</remarks>
    [HttpPost("process")]
    [ProducesResponseType(typeof(ApiResponse<ExceptionCaseDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Process([FromBody] ExceptionCaseProcessDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _exceptionCaseService.ProcessAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取案件详情
    /// </summary>
    /// <remarks>包含完整的处理过程日志</remarks>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ExceptionCaseDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await _exceptionCaseService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// 查询案件列表
    /// </summary>
    /// <remarks>支持按案件类型、状态、关联车辆/交易、处理人、优先级、时间范围组合检索</remarks>
    [HttpGet("query")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ExceptionCaseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Query([FromQuery] ExceptionCaseQueryDto dto)
    {
        var result = await _exceptionCaseService.QueryAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 分派案件
    /// </summary>
    [HttpPost("{caseId}/assign")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Assign(long caseId, [FromQuery] long assigneeId, [FromQuery] string? assigneeName, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _exceptionCaseService.AssignAsync(caseId, assigneeId, assigneeName, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取案件处理日志
    /// </summary>
    [HttpGet("{caseId}/logs")]
    [ProducesResponseType(typeof(ApiResponse<List<ExceptionCaseLogDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLogs(long caseId)
    {
        var result = await _exceptionCaseService.GetProcessingLogsAsync(caseId);
        return Ok(result);
    }

    /// <summary>
    /// 导出案件数据
    /// </summary>
    /// <remarks>按条件批量导出异常案件为CSV格式，支持统计分析</remarks>
    [HttpGet("export")]
    [ProducesResponseType(typeof(ApiResponse<byte[]>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export([FromQuery] ExceptionCaseQueryDto dto)
    {
        var result = await _exceptionCaseService.ExportAsync(dto);
        if (result.Code != 0) return Ok(result);
        return File(result.Data!, "text/csv; charset=utf-8",
            $"ExceptionCases_{DateTime.Now:yyyyMMddHHmmss}.csv");
    }
}

/// <summary>
/// 统计分析控制器
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService _statisticsService;
    private readonly ILogger<StatisticsController> _logger;

    public StatisticsController(
        IStatisticsService statisticsService,
        ILogger<StatisticsController> logger)
    {
        _statisticsService = statisticsService;
        _logger = logger;
    }

    /// <summary>
    /// 交易统计概览
    /// </summary>
    /// <remarks>统计指定时间段的总交易量、交易金额、均价及各状态交易数量</remarks>
    [HttpGet("transaction/overview")]
    [ProducesResponseType(typeof(ApiResponse<TransactionStatisticsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransactionOverview([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetTransactionStatisticsAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 品牌车型交易量统计
    /// </summary>
    [HttpGet("transaction/brands")]
    [ProducesResponseType(typeof(ApiResponse<List<BrandStatisticsDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBrandStatistics([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetBrandStatisticsAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 车型交易量TOP N
    /// </summary>
    [HttpGet("transaction/models")]
    [ProducesResponseType(typeof(ApiResponse<List<ModelStatisticsDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetModelStatistics([FromQuery] StatisticsQueryDto dto, [FromQuery] int topN = 20)
    {
        var result = await _statisticsService.GetModelStatisticsAsync(dto, topN);
        return Ok(result);
    }

    /// <summary>
    /// 鉴定等级分布统计
    /// </summary>
    /// <remarks>统计各鉴定等级（优秀/良好/一般/较差）的车辆数量、占比及平均得分</remarks>
    [HttpGet("inspection/grades")]
    [ProducesResponseType(typeof(ApiResponse<List<InspectionGradeStatisticsDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInspectionGradeDistribution([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetInspectionGradeStatisticsAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 过户办理时效统计
    /// </summary>
    /// <remarks>统计各流程节点的办理时长、按时完成率、超时率</remarks>
    [HttpGet("workflow/timeliness")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowTimelinessDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkflowTimeliness([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetWorkflowTimelinessAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 异常案件统计分析
    /// </summary>
    /// <remarks>统计案件总量、在办数、已解决数、解决率、平均解决时长、案件类型占比</remarks>
    [HttpGet("exception/overview")]
    [ProducesResponseType(typeof(ApiResponse<ExceptionCaseStatisticsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExceptionOverview([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetExceptionCaseStatisticsAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 业务日趋势数据
    /// </summary>
    /// <remarks>按日/周/月统计各业务指标的趋势变化</remarks>
    [HttpGet("daily-trend")]
    [ProducesResponseType(typeof(ApiResponse<List<DailyStatisticsDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDailyTrend([FromQuery] StatisticsQueryDto dto)
    {
        var result = await _statisticsService.GetDailyTrendAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 生成运营周报/月报
    /// </summary>
    /// <remarks>汇总指定时间段的全部运营数据，生成综合报告</remarks>
    [HttpGet("report")]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMonthlyReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWeeklyMonthlyReport([FromQuery] StatisticsQueryDto dto, [FromQuery] string reportType = "weekly")
    {
        var result = await _statisticsService.GetWeeklyMonthlyReportAsync(dto, reportType);
        return Ok(result);
    }
}
