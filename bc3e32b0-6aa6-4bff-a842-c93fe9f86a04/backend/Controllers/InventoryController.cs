using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    [HttpGet("materials")]
    public async Task<ActionResult<ApiResponse<PagedResult<Material>>>> GetMaterials(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] MaterialCategory? category = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _inventoryService.GetMaterialsAsync(query, category);
        return Ok(ApiResponse<PagedResult<Material>>.Success(result));
    }

    [HttpGet("materials/{id}")]
    public async Task<ActionResult<ApiResponse<Material>>> GetMaterial(Guid id)
    {
        var material = await _inventoryService.GetMaterialByIdAsync(id);
        if (material == null)
            return NotFound(ApiResponse.Fail("原料不存在", 404));

        return Ok(ApiResponse<Material>.Success(material));
    }

    [HttpPost("materials")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Material>>> CreateMaterial([FromBody] Material material)
    {
        var result = await _inventoryService.CreateMaterialAsync(material);
        return CreatedAtAction(nameof(GetMaterial), new { id = result.Id }, ApiResponse<Material>.Success(result));
    }

    [HttpPut("materials/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Material>>> UpdateMaterial(Guid id, [FromBody] Material material)
    {
        try
        {
            var result = await _inventoryService.UpdateMaterialAsync(id, material);
            return Ok(ApiResponse<Material>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("materials/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteMaterial(Guid id)
    {
        try
        {
            await _inventoryService.DeleteMaterialAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpGet("transactions")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<PagedResult<MaterialTransaction>>>> GetTransactions(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? materialId = null,
        [FromQuery] TransactionType? type = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize };
        var result = await _inventoryService.GetTransactionsAsync(query, materialId, type);
        return Ok(ApiResponse<PagedResult<MaterialTransaction>>.Success(result));
    }

    [HttpPost("transactions")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MaterialTransaction>>> AddTransaction([FromBody] MaterialTransaction transaction)
    {
        var result = await _inventoryService.AddTransactionAsync(transaction);
        return Ok(ApiResponse<MaterialTransaction>.Success(result));
    }

    [HttpGet("alerts")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<MaterialAlert>>>> GetAlerts([FromQuery] bool? isRead = null)
    {
        var alerts = await _inventoryService.GetAlertsAsync(isRead);
        return Ok(ApiResponse<List<MaterialAlert>>.Success(alerts));
    }

    [HttpPost("alerts/{id}/read")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> MarkAlertAsRead(Guid id)
    {
        await _inventoryService.MarkAlertAsReadAsync(id);
        return Ok(ApiResponse.Success("已标记为已读"));
    }

    [HttpGet("purchase-suggestions")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<PurchaseSuggestion>>>> GetPurchaseSuggestions()
    {
        var suggestions = await _inventoryService.GeneratePurchaseSuggestionsAsync();
        return Ok(ApiResponse<List<PurchaseSuggestion>>.Success(suggestions));
    }

    [HttpPost("check-alerts")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> CheckAlerts()
    {
        await _inventoryService.CheckInventoryAlertsAsync();
        return Ok(ApiResponse.Success("库存预警检查完成"));
    }
}
