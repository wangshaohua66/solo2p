using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    [HttpGet("summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetSummary(CancellationToken cancellationToken)
    {
        var result = await _inventoryService.GetInventorySummaryAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("items")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<InventoryItemDto>>> GetItems([FromQuery] SearchInventoryQuery query, CancellationToken cancellationToken)
    {
        var result = await _inventoryService.GetInventoryItemsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("alerts")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryAlertDto>>> GetAlerts(CancellationToken cancellationToken)
    {
        var alerts = await _inventoryService.GetInventoryAlertsAsync(cancellationToken);
        return Ok(alerts);
    }

    [HttpGet("balance-analysis")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<BloodTypeBalanceDto>> GetBalanceAnalysis(CancellationToken cancellationToken)
    {
        var analysis = await _inventoryService.GetBloodTypeBalanceAnalysisAsync(cancellationToken);
        return Ok(analysis);
    }

    [HttpGet("collection-plan")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<BloodCollectionPlanDto>> GetCollectionPlan(CancellationToken cancellationToken)
    {
        var plan = await _inventoryService.GenerateCollectionPlanAsync(cancellationToken);
        return Ok(plan);
    }

    [HttpGet("product/{productId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> GetItemByProduct(Guid productId, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.GetInventoryItemByProductIdAsync(productId, cancellationToken);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost("product/{productId:guid}/reserve")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReserveProduct(Guid productId, [FromBody] ReserveRequest request, CancellationToken cancellationToken)
    {
        await _inventoryService.ReserveProductAsync(productId, request.ReservedUntil, cancellationToken);
        return Ok(new { message = "Product reserved", productId });
    }

    [HttpPost("product/{productId:guid}/release")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReleaseReservation(Guid productId, CancellationToken cancellationToken)
    {
        await _inventoryService.ReleaseReservationAsync(productId, cancellationToken);
        return Ok(new { message = "Reservation released", productId });
    }

    [HttpPost("process-expired")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessExpired(CancellationToken cancellationToken)
    {
        await _inventoryService.ProcessExpiredProductsAsync(cancellationToken);
        return Ok(new { message = "Expired products processed" });
    }

    [HttpGet("history")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryHistoryDto>>> GetHistory([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var history = await _inventoryService.GetInventoryHistoryAsync(startDate, endDate, cancellationToken);
        return Ok(history);
    }

    [HttpGet("trend")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<InventoryTrendDto>> GetTrend([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var trend = await _inventoryService.GetInventoryTrendAsync(days, cancellationToken);
        return Ok(trend);
    }

    [HttpPut("safety-stock")]
    [Authorize(Policy = "AdminWithSecondaryAuth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetSafetyStockLevel([FromBody] SetSafetyStockRequest request, CancellationToken cancellationToken)
    {
        await _inventoryService.SetSafetyStockLevelAsync(request.ProductType, request.BloodType, request.RhFactor, request.MinimumLevel, cancellationToken);
        return Ok(new { message = "Safety stock level updated" });
    }

    [HttpGet("settings")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<InventorySettingsDto>> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await _inventoryService.GetInventorySettingsAsync(cancellationToken);
        return Ok(settings);
    }
}

public record ReserveRequest(DateTime ReservedUntil);
public record SetSafetyStockRequest(BloodProductType ProductType, BloodType BloodType, RhFactor RhFactor, int MinimumLevel);
