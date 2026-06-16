using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartParking.API.Common;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Controllers;

/// <summary>
/// 计费与支付 API
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class BillingController : ControllerBase
{
    private readonly IBillingService _service;
    private readonly ILogger<BillingController> _logger;

    public BillingController(IBillingService service, ILogger<BillingController> logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// 计算停车费用
    /// </summary>
    [HttpPost("calculate/parking")]
    [ProducesResponseType(typeof(ApiResponse<BillingCalculationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<BillingCalculationDto>>> CalculateParking(
        [FromBody] BillingCalculationRequest request)
    {
        var result = await _service.CalculateParkingAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// 计算充电费用
    /// </summary>
    [HttpPost("calculate/charging")]
    [ProducesResponseType(typeof(ApiResponse<BillingCalculationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<BillingCalculationDto>>> CalculateCharging(
        [FromBody] ChargingBillingRequest request)
    {
        var result = await _service.CalculateChargingAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// 创建支付订单
    /// </summary>
    [HttpPost("orders")]
    [ProducesResponseType(typeof(ApiResponse<PaymentOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PaymentOrderDto>>> CreateOrder(
        [FromBody] CreatePaymentOrderRequest request)
    {
        var userId = GetUserId();
        var result = await _service.CreateOrderAsync(request, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 支付订单
    /// </summary>
    [HttpPost("orders/{orderId}/pay")]
    [ProducesResponseType(typeof(ApiResponse<PayOrderResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PayOrderResponse>>> PayOrder(
        string orderId,
        [FromBody] PayOrderRequest request)
    {
        var userId = GetUserId();
        var result = await _service.PayOrderAsync(orderId, request, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 订单退款
    /// </summary>
    [HttpPost("orders/{orderId}/refund")]
    public async Task<ActionResult<ApiResponse>> RefundOrder(string orderId, [FromBody] RefundRequest request)
    {
        request.OrderId = orderId;
        var userId = GetUserId();
        var result = await _service.RefundOrderAsync(request, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取订单列表
    /// </summary>
    [HttpGet("orders")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<PaymentOrderDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<PaymentOrderDto>>>> GetOrders(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] OrderStatus? status = null,
        [FromQuery] string? type = null)
    {
        var userId = User.IsInRole("CarOwner") ? GetUserId() : null;
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _service.GetOrdersAsync(query, status?.ToString(), type, userId);
        return Ok(result);
    }

    /// <summary>
    /// 获取订单详情
    /// </summary>
    [HttpGet("orders/{orderId}")]
    [ProducesResponseType(typeof(ApiResponse<PaymentOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PaymentOrderDto>>> GetOrder(string orderId)
    {
        var userId = GetUserId();
        var result = await _service.GetOrderByIdAsync(orderId, userId);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 申请发票
    /// </summary>
    [HttpPost("orders/{orderId}/invoice")]
    [ProducesResponseType(typeof(ApiResponse<GenerateInvoiceResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<GenerateInvoiceResponse>>> GenerateInvoice(string orderId)
    {
        var userId = GetUserId();
        var result = await _service.GenerateInvoiceAsync(orderId, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取所有计费规则
    /// </summary>
    [HttpGet("rules")]
    [Authorize(Policy = "ParkOperator")]
    [ProducesResponseType(typeof(ApiResponse<List<BillingRuleDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<BillingRuleDto>>>> GetRules()
    {
        var result = await _service.GetRulesAsync();
        return Ok(result);
    }

    /// <summary>
    /// 创建计费规则
    /// </summary>
    [HttpPost("rules")]
    [Authorize(Policy = "ParkOperator")]
    public async Task<ActionResult<ApiResponse<BillingRuleDto>>> CreateRule([FromBody] BillingRuleDto request)
    {
        var result = await _service.CreateRuleAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// 更新计费规则
    /// </summary>
    [HttpPut("rules/{ruleId}")]
    [Authorize(Policy = "ParkOperator")]
    public async Task<ActionResult<ApiResponse<BillingRuleDto>>> UpdateRule(
        string ruleId, [FromBody] BillingRuleDto request)
    {
        var result = await _service.UpdateRuleAsync(ruleId, request);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 启用/禁用计费规则
    /// </summary>
    [HttpPut("rules/{ruleId}/toggle")]
    [Authorize(Policy = "ParkOperator")]
    public async Task<ActionResult<ApiResponse>> ToggleRule(string ruleId, [FromBody] ToggleRuleRequest request)
    {
        var result = await _service.ToggleRuleAsync(ruleId, request.IsEnabled);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    private string GetUserId()
    {
        return User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? throw new UnauthorizedAccessException();
    }
}
