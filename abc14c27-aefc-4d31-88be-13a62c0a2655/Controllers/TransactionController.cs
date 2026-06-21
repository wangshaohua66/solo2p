using Microsoft.AspNetCore.Mvc;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Services;

namespace UsedVehicleTransaction.Controllers;

/// <summary>
/// 交易管理控制器 - 交易登记、过户流程与档案管理
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TransactionController : ControllerBase
{
    private readonly ITransactionService _transactionService;
    private readonly IWorkflowService _workflowService;
    private readonly IArchiveService _archiveService;
    private readonly ILogger<TransactionController> _logger;

    public TransactionController(
        ITransactionService transactionService,
        IWorkflowService workflowService,
        IArchiveService archiveService,
        ILogger<TransactionController> logger)
    {
        _transactionService = transactionService;
        _workflowService = workflowService;
        _archiveService = archiveService;
        _logger = logger;
    }

    #region 交易登记管理

    /// <summary>
    /// 创建交易登记
    /// </summary>
    /// <remarks>录入买卖双方信息与交易价格，自动计算税费和服务费</remarks>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<TransactionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create([FromBody] TransactionCreateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _transactionService.CreateAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 更新交易信息
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<TransactionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(long id, [FromBody] TransactionUpdateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _transactionService.UpdateAsync(id, dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取交易详情
    /// </summary>
    /// <remarks>包含车辆信息、鉴定报告、过户流程状态、档案材料等完整信息</remarks>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<TransactionDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await _transactionService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// 查询交易列表
    /// </summary>
    /// <remarks>支持按交易编号、VIN码、买卖双方姓名、状态、时间范围组合检索</remarks>
    [HttpGet("query")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<TransactionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Query([FromQuery] TransactionQueryDto dto)
    {
        var result = await _transactionService.QueryAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 更新交易状态
    /// </summary>
    [HttpPut("{id}/status")]
    [ProducesResponseType(typeof(ApiResponse<TransactionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStatus(long id, [FromQuery] TransactionStatus status, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _transactionService.UpdateStatusAsync(id, status, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 取消交易
    /// </summary>
    [HttpPost("{id}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Cancel(long id, [FromQuery] string reason, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _transactionService.CancelAsync(id, operatorId, reason);
        return Ok(result);
    }

    #endregion

    #region 过户流程引擎

    /// <summary>
    /// 启动过户流程
    /// </summary>
    /// <remarks>
    /// 自动创建8个标准流程节点：环保审核、安检核验、税费核算、登记受理、行驶证变更、号牌发放、档案归档、办结通知。
    /// 支持串并行混合路由，每个节点设置办理时限。
    /// </remarks>
    [HttpPost("workflow/start")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowInstanceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartWorkflow([FromBody] WorkflowStartDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _workflowService.StartWorkflowAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 办理流程节点
    /// </summary>
    /// <remarks>节点办理完成后，自动触发后续节点启动（满足前置条件的节点）</remarks>
    [HttpPost("workflow/node/process")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowNodeExecutionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessWorkflowNode([FromBody] WorkflowNodeProcessDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _workflowService.ProcessNodeAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 跳过流程节点
    /// </summary>
    /// <remarks>特殊情况下跳过某个节点，需填写跳过原因</remarks>
    [HttpPost("workflow/node/skip")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowNodeExecutionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SkipWorkflowNode([FromBody] WorkflowNodeSkipDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _workflowService.SkipNodeAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取流程实例详情
    /// </summary>
    [HttpGet("workflow/instances/{instanceId}")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowInstanceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkflowInstance(long instanceId)
    {
        var result = await _workflowService.GetInstanceByIdAsync(instanceId);
        return Ok(result);
    }

    /// <summary>
    /// 获取指定交易的所有流程历史
    /// </summary>
    [HttpGet("{transactionId}/workflow")]
    [ProducesResponseType(typeof(ApiResponse<List<WorkflowInstanceDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkflowByTransaction(long transactionId)
    {
        var result = await _workflowService.GetInstancesByTransactionIdAsync(transactionId);
        return Ok(result);
    }

    /// <summary>
    /// 获取当前流程状态
    /// </summary>
    /// <remarks>查询指定交易当前进行到哪个流程节点及其状态</remarks>
    [HttpGet("{transactionId}/workflow/current")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowInstanceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentWorkflowStatus(long transactionId)
    {
        var result = await _workflowService.GetCurrentStatusAsync(transactionId);
        return Ok(result);
    }

    /// <summary>
    /// 触发超时检查与催办通知
    /// </summary>
    /// <remarks>定时任务接口，检查超时节点并发送催办提醒</remarks>
    [HttpPost("workflow/check-timeout")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckTimeoutAndRemind()
    {
        var result = await _workflowService.CheckTimeoutAndSendReminderAsync();
        return Ok(result);
    }

    #endregion

    #region 档案管理

    /// <summary>
    /// 上传档案材料
    /// </summary>
    /// <remarks>上传车辆证件、鉴定报告、交易合同等材料，按交易编号组卷存储</remarks>
    [HttpPost("archives/upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<ArchiveFileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UploadArchive([FromForm] ArchiveUploadDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _archiveService.UploadAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 批量上传档案材料
    /// </summary>
    [HttpPost("archives/batch-upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<List<ArchiveFileDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> BatchUploadArchives([FromForm] ArchiveBatchUploadDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _archiveService.BatchUploadAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 档案检索
    /// </summary>
    /// <remarks>
    /// 支持按VIN码、买方姓名、交易时间范围、档案类型组合检索，支持OCR识别结果全文检索。
    /// 检索响应时间小于2秒。
    /// </remarks>
    [HttpGet("archives/search")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ArchiveFileDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchArchives([FromQuery] ArchiveSearchDto dto)
    {
        var result = await _archiveService.SearchAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 获取档案详情
    /// </summary>
    [HttpGet("archives/{id}")]
    [ProducesResponseType(typeof(ApiResponse<ArchiveFileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetArchive(long id)
    {
        var result = await _archiveService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// 删除档案
    /// </summary>
    [HttpDelete("archives/{id}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteArchive(long id, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _archiveService.DeleteAsync(id, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取指定交易的全部档案
    /// </summary>
    [HttpGet("{transactionId}/archives")]
    [ProducesResponseType(typeof(ApiResponse<List<ArchiveFileDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetArchivesByTransaction(long transactionId)
    {
        var result = await _archiveService.GetByTransactionIdAsync(transactionId);
        return Ok(result);
    }

    /// <summary>
    /// 获取指定车辆的全部档案
    /// </summary>
    [HttpGet("vehicle/{vehicleId}/archives")]
    [ProducesResponseType(typeof(ApiResponse<List<ArchiveFileDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetArchivesByVehicle(long vehicleId)
    {
        var result = await _archiveService.GetByVehicleIdAsync(vehicleId);
        return Ok(result);
    }

    /// <summary>
    /// 执行OCR识别
    /// </summary>
    /// <remarks>对档案材料进行OCR文字识别，支持全文检索，提取关键信息作为检索关键词</remarks>
    [HttpPost("archives/{id}/ocr")]
    [ProducesResponseType(typeof(ApiResponse<OcrResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessOcr(long id, [FromHeader(Name = "X-Operator-Id")] long operatorId = 4)
    {
        var result = await _archiveService.ProcessOcrAsync(id, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 下载档案文件
    /// </summary>
    [HttpGet("archives/{id}/download")]
    public async Task<IActionResult> DownloadArchive(long id)
    {
        var result = await _archiveService.DownloadAsync(id);
        if (result.Code != 0)
        {
            return Ok(result);
        }
        var (filePath, fileName) = result.Data!;
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, "application/octet-stream", fileName);
    }

    #endregion
}
