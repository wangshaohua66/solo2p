using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesController : ControllerBase
{
    private readonly ISalesService _salesService;

    public SalesController(ISalesService salesService)
    {
        _salesService = salesService;
    }

    [HttpGet("items")]
    public async Task<ActionResult<ApiResponse<PagedResult<SalesItem>>>> GetSalesItems(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] SalesStatus? status = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _salesService.GetSalesItemsAsync(query, status);
        return Ok(ApiResponse<PagedResult<SalesItem>>.Success(result));
    }

    [HttpGet("items/{id}")]
    public async Task<ActionResult<ApiResponse<SalesItem>>> GetSalesItem(Guid id)
    {
        var item = await _salesService.GetSalesItemByIdAsync(id);
        if (item == null)
            return NotFound(ApiResponse.Fail("销售记录不存在", 404));

        return Ok(ApiResponse<SalesItem>.Success(item));
    }

    [HttpPost("items")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SalesItem>>> CreateSalesItem([FromBody] SalesItem item)
    {
        var result = await _salesService.CreateSalesItemAsync(item);
        return CreatedAtAction(nameof(GetSalesItem), new { id = result.Id }, ApiResponse<SalesItem>.Success(result));
    }

    [HttpPut("items/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SalesItem>>> UpdateSalesItem(Guid id, [FromBody] SalesItem item)
    {
        try
        {
            var result = await _salesService.UpdateSalesItemAsync(id, item);
            return Ok(ApiResponse<SalesItem>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("items/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteSalesItem(Guid id)
    {
        try
        {
            await _salesService.DeleteSalesItemAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("items/{id}/sold")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SalesItem>>> MarkAsSold(
        Guid id,
        [FromBody] MarkSoldRequest request)
    {
        try
        {
            var result = await _salesService.MarkAsSoldAsync(id, request.BuyerName, request.BuyerContact);
            return Ok(ApiResponse<SalesItem>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("custom-orders")]
    public async Task<ActionResult<ApiResponse<PagedResult<CustomOrder>>>> GetCustomOrders(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] OrderStatus? status = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _salesService.GetCustomOrdersAsync(query, status);
        return Ok(ApiResponse<PagedResult<CustomOrder>>.Success(result));
    }

    [HttpGet("custom-orders/{id}")]
    public async Task<ActionResult<ApiResponse<CustomOrder>>> GetCustomOrder(Guid id)
    {
        var order = await _salesService.GetCustomOrderByIdAsync(id);
        if (order == null)
            return NotFound(ApiResponse.Fail("定制单不存在", 404));

        return Ok(ApiResponse<CustomOrder>.Success(order));
    }

    [HttpPost("custom-orders")]
    public async Task<ActionResult<ApiResponse<CustomOrder>>> CreateCustomOrder([FromBody] CustomOrder order)
    {
        var result = await _salesService.CreateCustomOrderAsync(order);
        return CreatedAtAction(nameof(GetCustomOrder), new { id = result.Id }, ApiResponse<CustomOrder>.Success(result));
    }

    [HttpPut("custom-orders/{id}")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<CustomOrder>>> UpdateCustomOrder(Guid id, [FromBody] CustomOrder order)
    {
        try
        {
            var result = await _salesService.UpdateCustomOrderAsync(id, order);
            return Ok(ApiResponse<CustomOrder>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("custom-orders/{id}/status")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<CustomOrder>>> UpdateStatus(
        Guid id,
        [FromBody] UpdateOrderStatusRequest request)
    {
        try
        {
            var result = await _salesService.UpdateStatusAsync(id, request.Status);
            return Ok(ApiResponse<CustomOrder>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("custom-orders/{id}/quote")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<CustomOrder>>> SubmitQuote(
        Guid id,
        [FromBody] SubmitQuoteRequest request)
    {
        try
        {
            var result = await _salesService.SubmitQuoteAsync(id, request.QuoteAmount);
            return Ok(ApiResponse<CustomOrder>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}

public class MarkSoldRequest
{
    public string BuyerName { get; set; } = string.Empty;
    public string BuyerContact { get; set; } = string.Empty;
}

public class UpdateOrderStatusRequest
{
    public OrderStatus Status { get; set; }
}

public class SubmitQuoteRequest
{
    public decimal QuoteAmount { get; set; }
}
