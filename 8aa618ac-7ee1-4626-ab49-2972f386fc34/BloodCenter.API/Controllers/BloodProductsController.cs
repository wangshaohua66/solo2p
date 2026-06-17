using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BloodProductsController : ControllerBase
{
    private readonly IComponentPreparationService _preparationService;

    public BloodProductsController(IComponentPreparationService preparationService)
    {
        _preparationService = preparationService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<BloodProductDto>>> GetProducts([FromQuery] SearchProductQuery query, CancellationToken cancellationToken)
    {
        var result = await _preparationService.GetProductsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodProductDto>> GetProduct(Guid id, CancellationToken cancellationToken)
    {
        var product = await _preparationService.GetProductByIdAsync(id, cancellationToken);
        return product == null ? NotFound() : Ok(product);
    }

    [HttpGet("by-code/{productCode}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodProductDto>> GetProductByCode(string productCode, CancellationToken cancellationToken)
    {
        var product = await _preparationService.GetProductByCodeAsync(productCode, cancellationToken);
        return product == null ? NotFound() : Ok(product);
    }

    [HttpGet("by-donation/{donationId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BloodProductDto>>> GetProductsByDonation(Guid donationId, CancellationToken cancellationToken)
    {
        var products = await _preparationService.GetProductsByDonationAsync(donationId, cancellationToken);
        return Ok(products);
    }

    [HttpPost("process-whole-blood/{donationId:guid}")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<BloodProductDto>>> ProcessWholeBlood(Guid donationId, [FromBody] ProcessRequest request, CancellationToken cancellationToken)
    {
        var products = await _preparationService.ProcessWholeBloodAsync(donationId, request.PreparedById, cancellationToken);
        return Ok(products);
    }

    [HttpPost("special-products")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BloodProductDto>> PrepareSpecialProduct([FromBody] CreateSpecialProductDto productDto, CancellationToken cancellationToken)
    {
        var product = await _preparationService.PrepareSpecialProductAsync(productDto, cancellationToken);
        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    [HttpPatch("{id:guid}/storage")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodProductDto>> UpdateStorage(Guid id, [FromBody] UpdateStorageRequest request, CancellationToken cancellationToken)
    {
        var product = await _preparationService.UpdateProductStorageAsync(id, request.StorageLocation, cancellationToken);
        return Ok(product);
    }

    [HttpGet("expiring")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BloodProductDto>>> GetExpiringProducts([FromQuery] int withinHours = 24, CancellationToken cancellationToken = default)
    {
        var products = await _preparationService.GetExpiringProductsAsync(withinHours, cancellationToken);
        return Ok(products);
    }

    [HttpGet("quarantined")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BloodProductDto>>> GetQuarantinedProducts(CancellationToken cancellationToken)
    {
        var products = await _preparationService.GetProductsToQuarantineAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("stats")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PreparationStatsDto>> GetStats([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var stats = await _preparationService.GetPreparationStatsAsync(startDate, endDate, cancellationToken);
        return Ok(stats);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProduct(Guid id, CancellationToken cancellationToken)
    {
        await _preparationService.DeleteProductAsync(id, cancellationToken);
        return NoContent();
    }
}

public record ProcessRequest(Guid PreparedById);
public record UpdateStorageRequest(string StorageLocation);
