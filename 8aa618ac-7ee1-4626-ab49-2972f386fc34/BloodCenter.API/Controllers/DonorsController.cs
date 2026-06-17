using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DonorsController : ControllerBase
{
    private readonly IDonorService _donorService;

    public DonorsController(IDonorService donorService)
    {
        _donorService = donorService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DonorDto>>> GetDonors([FromQuery] SearchDonorQuery query, CancellationToken cancellationToken)
    {
        var result = await _donorService.SearchDonorsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonorDto>> GetDonor(Guid id, CancellationToken cancellationToken)
    {
        var donor = await _donorService.GetDonorByIdAsync(id, cancellationToken);
        return donor == null ? NotFound() : Ok(donor);
    }

    [HttpGet("by-number/{donorNumber}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonorDto>> GetDonorByNumber(string donorNumber, CancellationToken cancellationToken)
    {
        var donor = await _donorService.GetDonorByNumberAsync(donorNumber, cancellationToken);
        return donor == null ? NotFound() : Ok(donor);
    }

    [HttpPost]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DonorDto>> CreateDonor([FromBody] CreateDonorDto donorDto, CancellationToken cancellationToken)
    {
        var donor = await _donorService.RegisterDonorAsync(donorDto, cancellationToken);
        return CreatedAtAction(nameof(GetDonor), new { id = donor.Id }, donor);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonorDto>> UpdateDonor(Guid id, [FromBody] UpdateDonorDto donorDto, CancellationToken cancellationToken)
    {
        var donor = await _donorService.UpdateDonorAsync(id, donorDto, cancellationToken);
        return Ok(donor);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDonor(Guid id, CancellationToken cancellationToken)
    {
        await _donorService.DeleteDonorAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/eligibility-check")]
    [Authorize(Policy = "Nurse")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EligibilityCheckResult>> CheckEligibility(Guid id, [FromBody] MedicalHistoryDto medicalHistory, CancellationToken cancellationToken)
    {
        var result = await _donorService.CheckEligibilityAsync(id, medicalHistory, cancellationToken);
        return Ok(result);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonorDto>> UpdateStatus(Guid id, [FromQuery] DonorStatus status, [FromQuery] DeferralReason? reason, [FromQuery] DateTime? deferralUntil, CancellationToken cancellationToken)
    {
        var donor = await _donorService.UpdateDonorStatusAsync(id, status, reason, deferralUntil, cancellationToken);
        return Ok(donor);
    }

    [HttpGet("{id:guid}/next-eligible-date")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DateTime>> GetNextEligibleDate(Guid id, CancellationToken cancellationToken)
    {
        var date = await _donorService.CalculateNextEligibleDateAsync(id, cancellationToken);
        return Ok(new { nextEligibleDate = date });
    }

    [HttpGet("recall")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<DonorDto>>> GetDonorsForRecall([FromQuery] int daysBefore = 7, CancellationToken cancellationToken = default)
    {
        var donors = await _donorService.GetDonorsForRecallAsync(daysBefore, cancellationToken);
        return Ok(donors);
    }

    [HttpGet("{id:guid}/donations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<DonationRecordDto>>> GetDonationHistory(Guid id, CancellationToken cancellationToken)
    {
        var history = await _donorService.GetDonationHistoryAsync(id, cancellationToken);
        return Ok(history);
    }
}
