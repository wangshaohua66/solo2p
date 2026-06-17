using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BloodCenter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DonationsController : ControllerBase
{
    private readonly IDonationService _donationService;

    public DonationsController(IDonationService donationService)
    {
        _donationService = donationService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DonationDto>>> GetDonations([FromQuery] SearchDonationQuery query, CancellationToken cancellationToken)
    {
        var result = await _donationService.GetDonationsAsync(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonationDto>> GetDonation(Guid id, CancellationToken cancellationToken)
    {
        var donation = await _donationService.GetDonationByIdAsync(id, cancellationToken);
        return donation == null ? NotFound() : Ok(donation);
    }

    [HttpGet("by-number/{donationNumber}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonationDto>> GetDonationByNumber(string donationNumber, CancellationToken cancellationToken)
    {
        var donation = await _donationService.GetDonationByNumberAsync(donationNumber, cancellationToken);
        return donation == null ? NotFound() : Ok(donation);
    }

    [HttpPost]
    [Authorize(Policy = "Nurse")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DonationDto>> CreateDonation([FromBody] CreateDonationDto donationDto, CancellationToken cancellationToken)
    {
        var donation = await _donationService.CreateDonationAsync(donationDto, cancellationToken);
        return CreatedAtAction(nameof(GetDonation), new { id = donation.Id }, donation);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Nurse")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DonationDto>> UpdateStatus(Guid id, [FromQuery] DonationStatus status, [FromQuery] string? notes, CancellationToken cancellationToken)
    {
        var donation = await _donationService.UpdateDonationStatusAsync(id, status, notes, cancellationToken);
        return Ok(donation);
    }

    [HttpPost("{id:guid}/initial-screening")]
    [Authorize(Policy = "Technician")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InitialScreeningDto>> RecordInitialScreening(Guid id, [FromBody] CreateInitialScreeningDto screeningDto, CancellationToken cancellationToken)
    {
        var screening = await _donationService.RecordInitialScreeningAsync(id, screeningDto, cancellationToken);
        return Ok(screening);
    }

    [HttpGet("by-donor/{donorId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<DonationDto>>> GetDonationsByDonor(Guid donorId, CancellationToken cancellationToken)
    {
        var donations = await _donationService.GetDonationsByDonorAsync(donorId, cancellationToken);
        return Ok(donations);
    }

    [HttpGet("stats")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<DonationStatsDto>> GetStats([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, CancellationToken cancellationToken)
    {
        var stats = await _donationService.GetDonationStatsAsync(startDate, endDate, cancellationToken);
        return Ok(stats);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Administrator")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDonation(Guid id, CancellationToken cancellationToken)
    {
        await _donationService.DeleteDonationAsync(id, cancellationToken);
        return NoContent();
    }
}
