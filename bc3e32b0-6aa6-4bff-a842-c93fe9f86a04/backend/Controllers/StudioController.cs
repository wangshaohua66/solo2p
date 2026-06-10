using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudioController : ControllerBase
{
    private readonly IStudioService _studioService;

    public StudioController(IStudioService studioService)
    {
        _studioService = studioService;
    }

    [HttpGet("stations")]
    public async Task<ActionResult<ApiResponse<List<Station>>>> GetStations([FromQuery] StationType? type = null)
    {
        var stations = await _studioService.GetStationsAsync(type);
        return Ok(ApiResponse<List<Station>>.Success(stations));
    }

    [HttpGet("stations/{id}")]
    public async Task<ActionResult<ApiResponse<Station>>> GetStation(Guid id)
    {
        var station = await _studioService.GetStationByIdAsync(id);
        if (station == null)
            return NotFound(ApiResponse.Fail("工位不存在", 404));

        return Ok(ApiResponse<Station>.Success(station));
    }

    [HttpPost("stations")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Station>>> CreateStation([FromBody] Station station)
    {
        var result = await _studioService.CreateStationAsync(station);
        return CreatedAtAction(nameof(GetStation), new { id = result.Id }, ApiResponse<Station>.Success(result));
    }

    [HttpPut("stations/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Station>>> UpdateStation(Guid id, [FromBody] Station station)
    {
        try
        {
            var result = await _studioService.UpdateStationAsync(id, station);
            return Ok(ApiResponse<Station>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("stations/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteStation(Guid id)
    {
        try
        {
            await _studioService.DeleteStationAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("bookings")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<StudioBooking>>>> GetBookings(
        [FromQuery] DateTime? date = null,
        [FromQuery] Guid? stationId = null,
        [FromQuery] Guid? memberId = null)
    {
        var bookings = await _studioService.GetBookingsAsync(date, stationId, memberId);
        return Ok(ApiResponse<List<StudioBooking>>.Success(bookings));
    }

    [HttpGet("bookings/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<StudioBooking>>> GetBooking(Guid id)
    {
        var booking = await _studioService.GetBookingByIdAsync(id);
        if (booking == null)
            return NotFound(ApiResponse.Fail("预约不存在", 404));

        return Ok(ApiResponse<StudioBooking>.Success(booking));
    }

    [HttpPost("bookings")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<StudioBooking>>> CreateBooking([FromBody] StudioBooking booking)
    {
        try
        {
            var memberId = GetCurrentUserId();
            booking.MemberId = memberId;
            
            var result = await _studioService.CreateBookingAsync(booking);
            return CreatedAtAction(nameof(GetBooking), new { id = result.Id }, ApiResponse<StudioBooking>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("bookings/{id}/cancel")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> CancelBooking(Guid id)
    {
        try
        {
            var memberId = GetCurrentUserId();
            await _studioService.CancelBookingAsync(id, memberId);
            return Ok(ApiResponse.Success("取消成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("bookings/{id}/check-in")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<StudioBooking>>> CheckIn(Guid id)
    {
        try
        {
            var result = await _studioService.CheckInAsync(id);
            return Ok(ApiResponse<StudioBooking>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("bookings/{id}/check-out")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<StudioBooking>>> CheckOut(Guid id)
    {
        try
        {
            var result = await _studioService.CheckOutAsync(id);
            return Ok(ApiResponse<StudioBooking>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("occupancy")]
    public async Task<ActionResult<ApiResponse<int>>> GetOccupancy([FromQuery] DateTime date)
    {
        var occupancy = await _studioService.GetOccupancyAsync(date);
        return Ok(ApiResponse<int>.Success(occupancy));
    }

    [HttpGet("availability")]
    public async Task<ActionResult<ApiResponse<bool>>> CheckAvailability(
        [FromQuery] Guid stationId,
        [FromQuery] DateTime startTime,
        [FromQuery] DateTime endTime,
        [FromQuery] Guid? excludeId = null)
    {
        var available = await _studioService.CheckAvailabilityAsync(stationId, startTime, endTime, excludeId);
        return Ok(ApiResponse<bool>.Success(available));
    }

    private Guid GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            throw new UnauthorizedAccessException();
        return userId;
    }
}
