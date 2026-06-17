using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BloodTestsController : ControllerBase
{
    private readonly IBloodTestService _bloodTestService;

    public BloodTestsController(IBloodTestService bloodTestService)
    {
        _bloodTestService = bloodTestService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<BloodTestDto>>> GetTests([FromQuery] SearchBloodTestQuery query, CancellationToken cancellationToken)
    {
        var result = await _bloodTestService.GetTestsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloodTestDto>> GetTest(Guid id, CancellationToken cancellationToken)
    {
        var test = await _bloodTestService.GetTestByIdAsync(id, cancellationToken);
        return test == null ? NotFound() : Ok(test);
    }

    [HttpGet("by-donation/{donationId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<BloodTestDto>>> GetTestsByDonation(Guid donationId, CancellationToken cancellationToken)
    {
        var tests = await _bloodTestService.GetTestsByDonationAsync(donationId, cancellationToken);
        return Ok(tests);
    }

    [HttpPost]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BloodTestDto>> RecordTest([FromBody] CreateBloodTestDto testDto, CancellationToken cancellationToken)
    {
        var test = await _bloodTestService.RecordTestResultAsync(testDto, cancellationToken);
        return CreatedAtAction(nameof(GetTest), new { id = test.Id }, test);
    }

    [HttpPost("batch")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IEnumerable<BloodTestDto>>> RecordBatchTests([FromBody] IEnumerable<CreateBloodTestDto> testDtos, CancellationToken cancellationToken)
    {
        var tests = await _bloodTestService.RecordBatchTestsAsync(testDtos, cancellationToken);
        return Ok(tests);
    }

    [HttpPut("{id:guid}/review")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<BloodTestDto>> ReviewTest(Guid id, [FromBody] ReviewTestRequest request, CancellationToken cancellationToken)
    {
        var test = await _bloodTestService.ReviewTestResultAsync(id, request.ReviewerId, request.Result, request.Comment, cancellationToken);
        return Ok(test);
    }

    [HttpPost("{donationId:guid}/release")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReleaseDonation(Guid donationId, CancellationToken cancellationToken)
    {
        await _bloodTestService.ReleaseDonationAsync(donationId, cancellationToken);
        return Ok(new { message = "Donation released successfully", donationId });
    }

    [HttpGet("{donationId:guid}/is-safe")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> IsDonationSafe(Guid donationId, CancellationToken cancellationToken)
    {
        var isSafe = await _bloodTestService.IsDonationSafeAsync(donationId, cancellationToken);
        return Ok(new { isSafe });
    }

    [HttpPost("quarantine-donor/{donorId:guid}")]
    [Authorize(Policy = "AdminWithSecondaryAuth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> QuarantineDonorProducts(Guid donorId, [FromBody] QuarantineRequest request, CancellationToken cancellationToken)
    {
        await _bloodTestService.QuarantineDonorProductsAsync(donorId, request.Reason, cancellationToken);
        return Ok(new { message = "Donor products quarantined", donorId });
    }

    [HttpGet("summary")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<TestSummaryDto>> GetSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var summary = await _bloodTestService.GetTestsSummaryAsync(startDate, endDate, cancellationToken);
        return Ok(summary);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTest(Guid id, CancellationToken cancellationToken)
    {
        await _bloodTestService.DeleteTestAsync(id, cancellationToken);
        return NoContent();
    }
}

public record ReviewTestRequest(Guid ReviewerId, TestResult Result, string Comment);
public record QuarantineRequest(string Reason);
