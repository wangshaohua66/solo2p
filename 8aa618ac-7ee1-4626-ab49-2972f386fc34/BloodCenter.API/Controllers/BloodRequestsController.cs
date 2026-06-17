using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BloodRequestsController : ControllerBase
{
    private readonly ICrossMatchService _crossMatchService;

    public BloodRequestsController(ICrossMatchService crossMatchService)
    {
        _crossMatchService = crossMatchService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<BloodRequestDto>>> GetRequests([FromQuery] SearchBloodRequestQuery query, CancellationToken cancellationToken)
    {
        var result = await _crossMatchService.GetRequestsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodRequestDto>> GetRequest(Guid id, CancellationToken cancellationToken)
    {
        var request = await _crossMatchService.GetRequestByIdAsync(id, cancellationToken);
        return request == null ? NotFound() : Ok(request);
    }

    [HttpGet("by-number/{requestNumber}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodRequestDto>> GetRequestByNumber(string requestNumber, CancellationToken cancellationToken)
    {
        var request = await _crossMatchService.GetRequestByNumberAsync(requestNumber, cancellationToken);
        return request == null ? NotFound() : Ok(request);
    }

    [HttpPost]
    [Authorize(Policy = "HospitalInterface")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BloodRequestDto>> CreateRequest([FromBody] CreateBloodRequestDto requestDto, CancellationToken cancellationToken)
    {
        var request = await _crossMatchService.CreateBloodRequestAsync(requestDto, cancellationToken);
        return CreatedAtAction(nameof(GetRequest), new { id = request.Id }, request);
    }

    [HttpGet("by-hospital/{hospitalId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BloodRequestDto>>> GetRequestsByHospital(Guid hospitalId, CancellationToken cancellationToken)
    {
        var requests = await _crossMatchService.GetRequestsByHospitalAsync(hospitalId, cancellationToken);
        return Ok(requests);
    }

    [HttpPost("{requestId:guid}/cross-match")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IEnumerable<CrossMatchResultDto>>> PerformCrossMatch(Guid requestId, [FromBody] CrossMatchRequest request, CancellationToken cancellationToken)
    {
        var results = await _crossMatchService.PerformCrossMatchAsync(requestId, request.TechnicianId, cancellationToken);
        return Ok(results);
    }

    [HttpPost("cross-matches")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CrossMatchResultDto>> RecordCrossMatch([FromBody] RecordCrossMatchDto matchDto, CancellationToken cancellationToken)
    {
        var result = await _crossMatchService.RecordCrossMatchResultAsync(matchDto, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{requestId:guid}/issue")]
    [Authorize(Policy = "AdminWithSecondaryAuth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IssueResultDto>> IssueProducts(Guid requestId, [FromBody] IssueRequest request, CancellationToken cancellationToken)
    {
        var result = await _crossMatchService.IssueProductsAsync(requestId, request.OperatorId, cancellationToken);
        return Ok(result);
    }

    [HttpPatch("{requestId:guid}/status")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodRequestDto>> UpdateStatus(Guid requestId, [FromBody] UpdateStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _crossMatchService.UpdateRequestStatusAsync(requestId, request.Status, request.Notes, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{requestId:guid}/compatible-products")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<CompatibleProductDto>>> FindCompatibleProducts(Guid requestId, CancellationToken cancellationToken)
    {
        var products = await _crossMatchService.FindCompatibleProductsAsync(requestId, cancellationToken);
        return Ok(products);
    }

    [HttpGet("stats")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestStatsDto>> GetStats([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var stats = await _crossMatchService.GetRequestStatsAsync(startDate, endDate, cancellationToken);
        return Ok(stats);
    }

    [HttpPost("{requestId:guid}/cancel")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelRequest(Guid requestId, [FromBody] CancelRequest request, CancellationToken cancellationToken)
    {
        await _crossMatchService.CancelRequestAsync(requestId, request.Reason, cancellationToken);
        return Ok(new { message = "Request cancelled", requestId });
    }
}

public record CrossMatchRequest(Guid TechnicianId);
public record IssueRequest(Guid OperatorId);
public record UpdateStatusRequest(RequestStatus Status, string? Notes);
public record CancelRequest(string Reason);
