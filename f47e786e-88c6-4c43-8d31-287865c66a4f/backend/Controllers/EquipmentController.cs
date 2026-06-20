using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;
using FireTraining.Services;

namespace FireTraining.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EquipmentController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IEquipmentService _equipmentService;

    public EquipmentController(AppDbContext context, IEquipmentService equipmentService)
    {
        _context = context;
        _equipmentService = equipmentService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Equipment>>> GetEquipment(
        string? category,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var equipment = await _equipmentService.GetEquipmentAsync(category, keyword, page, pageSize, cancellationToken);
        var total = await _equipmentService.GetEquipmentCountAsync(category, keyword, cancellationToken);

        return Ok(new { total, data = equipment });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Equipment>> GetEquipment(int id, CancellationToken cancellationToken)
    {
        var equipment = await _equipmentService.GetEquipmentByIdAsync(id, cancellationToken);
        if (equipment == null)
            return NotFound();

        return Ok(equipment);
    }

    [HttpPost]
    public async Task<ActionResult<Equipment>> CreateEquipment(
        Equipment equipment,
        CancellationToken cancellationToken)
    {
        var created = await _equipmentService.CreateEquipmentAsync(equipment, cancellationToken);
        return CreatedAtAction(nameof(GetEquipment), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEquipment(
        int id,
        Equipment equipment,
        CancellationToken cancellationToken)
    {
        if (id != equipment.Id)
            return BadRequest();

        var updated = await _equipmentService.UpdateEquipmentAsync(equipment, cancellationToken);
        if (updated == null)
            return NotFound();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEquipment(int id, CancellationToken cancellationToken)
    {
        var result = await _equipmentService.DeleteEquipmentAsync(id, cancellationToken);
        if (!result)
            return NotFound();

        return NoContent();
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<string>>> GetEquipmentCategories(CancellationToken cancellationToken)
    {
        var categories = await _context.Equipment
            .Where(e => e.IsActive)
            .Select(e => e.Category)
            .Distinct()
            .Where(c => c != null)
            .ToListAsync(cancellationToken);

        return Ok(categories!);
    }

    [HttpGet("reservations")]
    public async Task<ActionResult<IEnumerable<EquipmentReservation>>> GetReservations(
        int? equipmentId,
        int? stationId,
        ReservationStatus? status,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var reservations = await _equipmentService.GetReservationsAsync(
            equipmentId, stationId, status, startDate, endDate, page, pageSize, cancellationToken);

        var total = await _equipmentService.GetReservationCountAsync(
            equipmentId, stationId, status, startDate, endDate, cancellationToken);

        return Ok(new { total, data = reservations });
    }

    [HttpGet("reservations/{id}")]
    public async Task<ActionResult<EquipmentReservation>> GetReservation(
        int id,
        CancellationToken cancellationToken)
    {
        var reservation = await _context.EquipmentReservations
            .Include(r => r.Equipment)
            .Include(r => r.FireStation)
            .Include(r => r.Firefighter)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (reservation == null)
            return NotFound();

        return Ok(reservation);
    }

    [HttpPost("reservations")]
    public async Task<ActionResult<ReservationResult>> CreateReservation(
        EquipmentReservation reservation,
        CancellationToken cancellationToken)
    {
        var result = await _equipmentService.CreateReservationAsync(reservation, cancellationToken);

        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetReservation), new { id = result.ReservationId }, result);
    }

    [HttpPost("reservations/{id}/approve")]
    public async Task<IActionResult> ApproveReservation(
        int id,
        [FromQuery] int approvedBy,
        CancellationToken cancellationToken)
    {
        var result = await _equipmentService.ApproveReservationAsync(id, approvedBy, cancellationToken);
        if (!result)
            return BadRequest(new { message = "审批失败，可能库存不足或状态不正确" });

        return NoContent();
    }

    [HttpPost("reservations/{id}/reject")]
    public async Task<IActionResult> RejectReservation(
        int id,
        [FromBody] string reason,
        [FromQuery] int approvedBy,
        CancellationToken cancellationToken)
    {
        var result = await _equipmentService.RejectReservationAsync(id, reason, approvedBy, cancellationToken);
        if (!result)
            return NotFound();

        return NoContent();
    }

    [HttpPost("reservations/{id}/pickup")]
    public async Task<IActionResult> PickupEquipment(int id, CancellationToken cancellationToken)
    {
        var result = await _equipmentService.PickupEquipmentAsync(id, cancellationToken);
        if (!result)
            return BadRequest(new { message = "领取失败，状态不正确" });

        return NoContent();
    }

    [HttpPost("reservations/{id}/return")]
    public async Task<IActionResult> ReturnEquipment(int id, CancellationToken cancellationToken)
    {
        var result = await _equipmentService.ReturnEquipmentAsync(id, cancellationToken);
        if (!result)
            return BadRequest(new { message = "归还失败，状态不正确" });

        return NoContent();
    }

    [HttpPost("reservations/{id}/cancel")]
    public async Task<IActionResult> CancelReservation(int id, CancellationToken cancellationToken)
    {
        await _equipmentService.CancelReservationAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("availability/check")]
    public async Task<ActionResult<bool>> CheckAvailability(
        int equipmentId,
        DateTime startTime,
        DateTime endTime,
        int quantity,
        int? excludeReservationId,
        CancellationToken cancellationToken)
    {
        var isAvailable = await _equipmentService.CheckAvailabilityAsync(
            equipmentId, startTime, endTime, quantity, excludeReservationId, cancellationToken);

        return Ok(new { isAvailable });
    }

    [HttpPost("availability/check")]
    public async Task<ActionResult<object>> CheckAvailabilityPost(
        [FromBody] AvailabilityCheckRequest request,
        CancellationToken cancellationToken)
    {
        var isAvailable = await _equipmentService.CheckAvailabilityAsync(
            request.EquipmentId, request.StartTime, request.EndTime, request.Qty, null, cancellationToken);

        var hasConflict = !isAvailable;
        var conflicts = new List<object>();
        var canOverrideByPriority = false;

        if (hasConflict)
        {
            var conflictingReservations = await _equipmentService.GetConflictingReservationsAsync(
                request.EquipmentId, request.StartTime, request.EndTime, null, cancellationToken);

            conflicts = conflictingReservations.Select(r => new
            {
                reservationId = r.Id,
                reason = $"与预约 {r.Id} 冲突",
                priority = r.Priority
            }).Cast<object>().ToList();

            if (request.Priority >= 3)
            {
                canOverrideByPriority = true;
            }
        }

        return Ok(new { hasConflict, conflicts, canOverrideByPriority });
    }

    [HttpGet("availability/conflicts")]
    public async Task<ActionResult<IEnumerable<EquipmentReservation>>> GetConflictingReservations(
        int equipmentId,
        DateTime startTime,
        DateTime endTime,
        int? excludeReservationId,
        CancellationToken cancellationToken)
    {
        var conflicts = await _equipmentService.GetConflictingReservationsAsync(
            equipmentId, startTime, endTime, excludeReservationId, cancellationToken);

        return Ok(conflicts);
    }

    [HttpGet("availability/slots")]
    public async Task<ActionResult<IEnumerable<SuggestedTimeSlot>>> GetAvailableSlots(
        int equipmentId,
        DateTime date,
        int quantity,
        CancellationToken cancellationToken)
    {
        var slots = await _equipmentService.GetAvailableSlotsAsync(equipmentId, date, quantity, cancellationToken);
        return Ok(slots);
    }

    [HttpGet("overdue")]
    public async Task<ActionResult<IEnumerable<Equipment>>> GetOverdueEquipment(CancellationToken cancellationToken)
    {
        var equipment = await _equipmentService.GetOverdueEquipmentAsync(cancellationToken);
        return Ok(equipment);
    }

    [HttpPost("overdue/reminders")]
    public async Task<IActionResult> SendOverdueReminders(CancellationToken cancellationToken)
    {
        await _equipmentService.SendOverdueRemindersAsync(cancellationToken);
        return Ok(new { message = "逾期提醒已发送" });
    }

    [HttpGet("statistics")]
    public async Task<ActionResult<EquipmentStatistics>> GetEquipmentStatistics(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _equipmentService.GetEquipmentStatisticsAsync(filter, cancellationToken);
        return Ok(stats);
    }

    [HttpGet("usage-ranking")]
    public async Task<ActionResult<IEnumerable<EquipmentUsageRanking>>> GetUsageRanking(
        int top = 10,
        CancellationToken cancellationToken = default)
    {
        var filter = new StatisticFilter();
        var stats = await _equipmentService.GetEquipmentStatisticsAsync(filter, cancellationToken);
        var ranking = stats.UsageRanking?.Take(top).ToList();
        return Ok(ranking ?? new List<EquipmentUsageRanking>());
    }
}
