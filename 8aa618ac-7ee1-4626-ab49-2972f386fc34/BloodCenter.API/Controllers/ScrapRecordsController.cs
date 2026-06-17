using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScrapRecordsController : ControllerBase
{
    private readonly IScrapTraceService _scrapTraceService;

    public ScrapRecordsController(IScrapTraceService scrapTraceService)
    {
        _scrapTraceService = scrapTraceService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ScrapRecordDto>>> GetScrapRecords([FromQuery] SearchScrapQuery query, CancellationToken cancellationToken)
    {
        var result = await _scrapTraceService.GetScrapRecordsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ScrapRecordDto>> GetScrapRecord(Guid id, CancellationToken cancellationToken)
    {
        var scrap = await _scrapTraceService.GetScrapRecordByIdAsync(id, cancellationToken);
        return scrap == null ? NotFound() : Ok(scrap);
    }

    [HttpGet("by-product/{productId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ScrapRecordDto>>> GetScrapsByProduct(Guid productId, CancellationToken cancellationToken)
    {
        var scraps = await _scrapTraceService.GetScrapsByProductAsync(productId, cancellationToken);
        return Ok(scraps);
    }

    [HttpPost]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ScrapRecordDto>> CreateScrapRecord([FromBody] CreateScrapRecordDto scrapDto, CancellationToken cancellationToken)
    {
        var scrap = await _scrapTraceService.CreateScrapRecordAsync(scrapDto, cancellationToken);
        return CreatedAtAction(nameof(GetScrapRecord), new { id = scrap.Id }, scrap);
    }

    [HttpPut("{id:guid}/approve")]
    [Authorize(Policy = "AdminWithSecondaryAuth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ScrapRecordDto>> ApproveScrapRecord(Guid id, [FromBody] ApproveRequest request, CancellationToken cancellationToken)
    {
        var scrap = await _scrapTraceService.ApproveScrapRecordAsync(id, request.ApprovedById, request.ApprovalNotes, cancellationToken);
        return Ok(scrap);
    }

    [HttpPost("process-auto-expired")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessAutoScrap(CancellationToken cancellationToken)
    {
        await _scrapTraceService.ProcessAutoScrapForExpiredProductsAsync(cancellationToken);
        return Ok(new { message = "Auto-scrap for expired products processed" });
    }

    [HttpGet("trace/product/{productId:guid}/forward")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TraceResultDto>> TraceForward(Guid productId, CancellationToken cancellationToken)
    {
        var trace = await _scrapTraceService.TraceProductForwardAsync(productId, cancellationToken);
        return Ok(trace);
    }

    [HttpGet("trace/product/{productId:guid}/backward")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TraceResultDto>> TraceBackward(Guid productId, CancellationToken cancellationToken)
    {
        var trace = await _scrapTraceService.TraceProductBackwardAsync(productId, cancellationToken);
        return Ok(trace);
    }

    [HttpGet("trace/donor/{donorId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<TraceResultDto>> TraceByDonor(Guid donorId, CancellationToken cancellationToken)
    {
        var trace = await _scrapTraceService.TraceByDonorAsync(donorId, cancellationToken);
        return Ok(trace);
    }

    [HttpGet("trace/patient/{patientId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<TraceResultDto>> TraceByPatient(string patientId, CancellationToken cancellationToken)
    {
        var trace = await _scrapTraceService.TraceByPatientAsync(patientId, cancellationToken);
        return Ok(trace);
    }

    [HttpGet("trace/product/{productId:guid}/full-chain")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<ProductTraceDto>>> GetFullTraceChain(Guid productId, CancellationToken cancellationToken)
    {
        var trace = await _scrapTraceService.GetFullTraceChainAsync(productId, cancellationToken);
        return Ok(trace);
    }

    [HttpGet("stats")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<ScrapStatsDto>> GetStats([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var stats = await _scrapTraceService.GetScrapStatsAsync(startDate, endDate, cancellationToken);
        return Ok(stats);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteScrapRecord(Guid id, CancellationToken cancellationToken)
    {
        await _scrapTraceService.DeleteScrapRecordAsync(id, cancellationToken);
        return NoContent();
    }
}

public record ApproveRequest(Guid ApprovedById, string? ApprovalNotes);
