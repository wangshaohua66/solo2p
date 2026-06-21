using Microsoft.AspNetCore.Mvc;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Services;

namespace UsedVehicleTransaction.Controllers;

/// <summary>
/// 车辆管理控制器 - 车辆准入审核与鉴定申请
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class VehicleController : ControllerBase
{
    private readonly IVehicleService _vehicleService;
    private readonly IComplianceService _complianceService;
    private readonly IInspectionService _inspectionService;
    private readonly ILogger<VehicleController> _logger;

    public VehicleController(
        IVehicleService vehicleService,
        IComplianceService complianceService,
        IInspectionService inspectionService,
        ILogger<VehicleController> logger)
    {
        _vehicleService = vehicleService;
        _complianceService = complianceService;
        _inspectionService = inspectionService;
        _logger = logger;
    }

    #region 车辆信息管理

    /// <summary>
    /// 录入车辆信息
    /// </summary>
    /// <remarks>
    /// 录入待交易车辆的基础信息，VIN码必须唯一且为17位
    /// </remarks>
    /// <param name="dto">车辆信息</param>
    /// <param name="operatorId">操作人ID（Header传递）</param>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<VehicleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] VehicleCreateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _vehicleService.CreateAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 更新车辆信息
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<VehicleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(long id, [FromBody] VehicleUpdateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _vehicleService.UpdateAsync(id, dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 删除车辆信息
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(long id, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _vehicleService.DeleteAsync(id, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取车辆详情
    /// </summary>
    /// <remarks>包含合规校验记录和鉴定工单历史</remarks>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<VehicleDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await _vehicleService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// 查询车辆列表
    /// </summary>
    [HttpGet("query")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<VehicleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Query([FromQuery] VehicleQueryDto dto)
    {
        var result = await _vehicleService.QueryAsync(dto);
        return Ok(result);
    }

    #endregion

    #region 车辆准入审核（合规校验）

    /// <summary>
    /// 发起车辆准入合规校验
    /// </summary>
    /// <remarks>
    /// 接收车辆VIN码后自动并联调用6个外部系统接口，核验12项合规条件，响应时间小于3秒。
    /// 任一条件不通过则拒绝准入并生成原因清单。
    /// </remarks>
    /// <param name="dto">合规校验请求</param>
    /// <param name="operatorId">操作人ID</param>
    [HttpPost("compliance/check")]
    [ProducesResponseType(typeof(ApiResponse<ComplianceCheckResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status408RequestTimeout)]
    public async Task<IActionResult> CheckCompliance([FromBody] ComplianceCheckRequestDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _complianceService.CheckComplianceAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取合规校验记录详情
    /// </summary>
    [HttpGet("compliance/records/{recordId}")]
    [ProducesResponseType(typeof(ApiResponse<ComplianceCheckRecordDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetComplianceRecord(long recordId)
    {
        var result = await _complianceService.GetRecordByIdAsync(recordId);
        return Ok(result);
    }

    /// <summary>
    /// 获取指定车辆的合规校验历史记录
    /// </summary>
    [HttpGet("{vehicleId}/compliance/records")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ComplianceCheckRecordDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetComplianceRecords(long vehicleId, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _complianceService.GetRecordsByVehicleIdAsync(vehicleId, pageIndex, pageSize);
        return Ok(result);
    }

    /// <summary>
    /// 人工复核合规校验结果
    /// </summary>
    /// <remarks>合规校验不通过时，支持审核员进行人工复核，通过后可准予准入</remarks>
    [HttpPost("compliance/review")]
    [ProducesResponseType(typeof(ApiResponse<ComplianceCheckResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ManualReview([FromBody] ComplianceReviewDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _complianceService.ManualReviewAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 例外审批
    /// </summary>
    /// <remarks>对特殊情况（如历史遗留问题）进行例外审批，通过后准予准入</remarks>
    [HttpPost("compliance/exception-approval")]
    [ProducesResponseType(typeof(ApiResponse<ComplianceCheckResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExceptionApproval([FromBody] ComplianceExceptionApprovalDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _complianceService.ExceptionApprovalAsync(dto, operatorId);
        return Ok(result);
    }

    #endregion

    #region 技术状况鉴定

    /// <summary>
    /// 创建鉴定工单
    /// </summary>
    /// <remarks>合规校验通过后，创建技术状况鉴定工单并指派鉴定师</remarks>
    [HttpPost("inspection/orders")]
    [ProducesResponseType(typeof(ApiResponse<InspectionOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateInspectionOrder([FromBody] InspectionOrderCreateDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _inspectionService.CreateOrderAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 开始鉴定工作
    /// </summary>
    [HttpPost("inspection/orders/{orderId}/start")]
    [ProducesResponseType(typeof(ApiResponse<InspectionOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartInspection(long orderId, [FromHeader(Name = "X-Inspector-Id")] long inspectorId = 3)
    {
        var result = await _inspectionService.StartInspectionAsync(orderId, inspectorId);
        return Ok(result);
    }

    /// <summary>
    /// 提交鉴定结果
    /// </summary>
    /// <remarks>
    /// 鉴定师完成148项检测指标评分后提交，系统按权重计算综合得分并自动判定等级。
    /// 鉴定报告生成时间小于5秒。
    /// </remarks>
    [HttpPost("inspection/orders/submit")]
    [ProducesResponseType(typeof(ApiResponse<InspectionOrderDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SubmitInspection([FromBody] InspectionSubmitDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 3)
    {
        var result = await _inspectionService.SubmitInspectionAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 审核鉴定报告
    /// </summary>
    [HttpPost("inspection/orders/review")]
    [ProducesResponseType(typeof(ApiResponse<InspectionOrderDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ReviewInspection([FromBody] InspectionReviewDto dto, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _inspectionService.ReviewInspectionAsync(dto, operatorId);
        return Ok(result);
    }

    /// <summary>
    /// 获取鉴定工单详情
    /// </summary>
    [HttpGet("inspection/orders/{orderId}")]
    [ProducesResponseType(typeof(ApiResponse<InspectionOrderDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInspectionOrder(long orderId)
    {
        var result = await _inspectionService.GetOrderByIdAsync(orderId);
        return Ok(result);
    }

    /// <summary>
    /// 查询鉴定工单列表
    /// </summary>
    [HttpGet("inspection/orders/query")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<InspectionOrderDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> QueryInspectionOrders([FromQuery] InspectionQueryDto dto)
    {
        var result = await _inspectionService.QueryOrdersAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// 获取检测指标库
    /// </summary>
    /// <remarks>获取148项检测指标，按5大类分类（发动机32、底盘28、车身45、电气18、路试25）</remarks>
    [HttpGet("inspection/items")]
    [ProducesResponseType(typeof(ApiResponse<List<InspectionItemLibraryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInspectionItems([FromQuery] InspectionCategory? category = null)
    {
        var result = await _inspectionService.GetItemLibraryByCategoryAsync(category);
        return Ok(result);
    }

    /// <summary>
    /// 生成标准化鉴定报告
    /// </summary>
    [HttpGet("inspection/orders/{orderId}/report")]
    [ProducesResponseType(typeof(ApiResponse<byte[]>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GenerateReport(long orderId)
    {
        var result = await _inspectionService.GenerateReportAsync(orderId);
        return Ok(result);
    }

    /// <summary>
    /// 取消鉴定工单
    /// </summary>
    [HttpPost("inspection/orders/{orderId}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelInspectionOrder(long orderId, [FromHeader(Name = "X-Operator-Id")] long operatorId = 1)
    {
        var result = await _inspectionService.CancelOrderAsync(orderId, operatorId);
        return Ok(result);
    }

    #endregion
}
