using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class BedController : ControllerBase
{
    private readonly IBedService _service;

    public BedController(IBedService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<Bed>>> GetAll([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllAsync(facilityId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Bed>> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<Bed>> Create([FromBody] Bed bed)
    {
        var result = await _service.CreateAsync(bed);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Bed bed)
    {
        try
        {
            await _service.UpdateAsync(id, bed);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            await _service.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("status/{status}")]
    public async Task<ActionResult<List<Bed>>> GetByStatus(string status, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByStatusAsync(status, facilityId);
    }

    [HttpGet("carezone/{careZone}")]
    public async Task<ActionResult<List<Bed>>> GetByCareZone(string careZone, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByCareZoneAsync(careZone, facilityId);
    }

    [HttpGet("floor/{floor}/{building}")]
    public async Task<ActionResult<List<Bed>>> GetByFloor(string floor, string building, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByFloorAsync(floor, building, facilityId);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetStats([FromQuery] string? facilityId = null)
    {
        var (total, occupied, available, maintenance) = await _service.GetStatsAsync(facilityId);
        return new { total, occupied, available, maintenance, occupancyRate = total > 0 ? Math.Round((decimal)occupied / total * 100, 2) : 0 };
    }

    [HttpPost("{bedId}/book")]
    public async Task<IActionResult> BookBed(string bedId, [FromQuery] string elderlyId, [FromQuery] DateTime expiryDate, [FromQuery] string operatorName)
    {
        try
        {
            await _service.BookBedAsync(bedId, elderlyId, expiryDate, operatorName);
            return Ok(new { message = "预约成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{bedId}/cancel-booking")]
    public async Task<IActionResult> CancelBooking(string bedId, [FromQuery] string operatorName)
    {
        try
        {
            await _service.CancelBookingAsync(bedId, operatorName);
            return Ok(new { message = "取消预约成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> TransferBed([FromQuery] string oldBedId, [FromQuery] string newBedId, [FromQuery] string elderlyId, [FromQuery] string operatorName)
    {
        try
        {
            await _service.TransferBedAsync(oldBedId, newBedId, elderlyId, operatorName);
            return Ok(new { message = "换床成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{bedId}/maintenance")]
    public async Task<IActionResult> SetMaintenance(string bedId, [FromQuery] DateTime startDate, [FromQuery] DateTime? endDate, [FromQuery] string notes, [FromQuery] string operatorName)
    {
        try
        {
            await _service.SetMaintenanceAsync(bedId, startDate, endDate, notes, operatorName);
            return Ok(new { message = "设置维修成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{bedId}/release-maintenance")]
    public async Task<IActionResult> ReleaseMaintenance(string bedId, [FromQuery] string operatorName)
    {
        try
        {
            await _service.ReleaseMaintenanceAsync(bedId, operatorName);
            return Ok(new { message = "释放维修状态成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{bedId}/calculate-fee")]
    public async Task<ActionResult<decimal>> CalculateBedFee(string bedId, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
    {
        try
        {
            return await _service.CalculateBedFeeAsync(bedId, startDate, endDate);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("{bedId}/history")]
    public async Task<ActionResult<List<BedHistory>>> GetBedHistory(string bedId)
    {
        try
        {
            return await _service.GetBedHistoryAsync(bedId);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
