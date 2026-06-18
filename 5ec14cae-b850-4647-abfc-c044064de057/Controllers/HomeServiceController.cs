using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class HomeServiceController : ControllerBase
{
    private readonly IHomeService _service;

    public HomeServiceController(IHomeService service)
    {
        _service = service;
    }

    [HttpGet("orders")]
    public async Task<ActionResult<List<HomeServiceOrder>>> GetAllOrders()
    {
        return await _service.GetAllOrdersAsync();
    }

    [HttpGet("orders/{id}")]
    public async Task<ActionResult<HomeServiceOrder>> GetOrderById(string id)
    {
        var result = await _service.GetOrderByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost("orders")]
    public async Task<ActionResult<HomeServiceOrder>> CreateOrder([FromBody] HomeServiceOrder order)
    {
        try
        {
            var result = await _service.CreateOrderAsync(order);
            return CreatedAtAction(nameof(GetOrderById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("orders/{id}")]
    public async Task<IActionResult> UpdateOrder(string id, [FromBody] HomeServiceOrder order)
    {
        try
        {
            await _service.UpdateOrderAsync(id, order);
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

    [HttpDelete("orders/{id}")]
    public async Task<IActionResult> DeleteOrder(string id)
    {
        try
        {
            await _service.DeleteOrderAsync(id);
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

    [HttpGet("orders/status/{status}")]
    public async Task<ActionResult<List<HomeServiceOrder>>> GetOrdersByStatus(string status)
    {
        return await _service.GetOrdersByStatusAsync(status);
    }

    [HttpGet("orders/elderly/{elderlyId}")]
    public async Task<ActionResult<List<HomeServiceOrder>>> GetOrdersByElderlyId(string elderlyId)
    {
        return await _service.GetOrdersByElderlyIdAsync(elderlyId);
    }

    [HttpGet("orders/range")]
    public async Task<ActionResult<List<HomeServiceOrder>>> GetOrdersByDateRange([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
    {
        return await _service.GetOrdersByDateRangeAsync(startDate, endDate);
    }

    [HttpGet("available-staff")]
    public async Task<ActionResult<List<HomeServiceStaff>>> GetAvailableStaff([FromQuery] string serviceType, [FromQuery] string area, [FromQuery] DateTime date, [FromQuery] string startTime, [FromQuery] string endTime)
    {
        return await _service.GetAvailableStaffAsync(serviceType, area, date, TimeSpan.Parse(startTime), TimeSpan.Parse(endTime));
    }

    [HttpPost("orders/{orderId}/assign-staff")]
    public async Task<IActionResult> AssignStaff(string orderId, [FromQuery] string staffId)
    {
        try
        {
            await _service.AssignStaffAsync(orderId, staffId);
            return Ok(new { message = "人员分配成功" });
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

    [HttpPost("orders/{orderId}/dispatch")]
    public async Task<IActionResult> DispatchOrder(string orderId, [FromQuery] string dispatchNote, [FromQuery] string? staffId = null)
    {
        try
        {
            await _service.DispatchOrderAsync(orderId, dispatchNote, staffId);
            return Ok(new { message = "派单成功" });
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

    [HttpPost("orders/{orderId}/check-in")]
    public async Task<IActionResult> CheckIn(string orderId, [FromQuery] double latitude, [FromQuery] double longitude, [FromQuery] string location)
    {
        try
        {
            await _service.CheckInAsync(orderId, latitude, longitude, location);
            return Ok(new { message = "签到成功" });
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

    [HttpPost("orders/{orderId}/check-out")]
    public async Task<IActionResult> CheckOut(string orderId, [FromBody] CheckOutRequest request)
    {
        try
        {
            await _service.CheckOutAsync(orderId, request.Record, request.Photos);
            return Ok(new { message = "签退成功" });
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

    [HttpPost("orders/{orderId}/cancel")]
    public async Task<IActionResult> CancelOrder(string orderId, [FromQuery] string reason, [FromQuery] string cancelledBy)
    {
        try
        {
            await _service.CancelOrderAsync(orderId, reason, cancelledBy);
            return Ok(new { message = "订单已取消" });
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

    [HttpPost("orders/{orderId}/status")]
    public async Task<IActionResult> UpdateOrderStatus(string orderId, [FromQuery] string status, [FromQuery] string? note = null)
    {
        await _service.UpdateOrderStatusAsync(orderId, status, note);
        return Ok(new { message = "状态已更新" });
    }

    [HttpGet("staff")]
    public async Task<ActionResult<List<HomeServiceStaff>>> GetAllStaff()
    {
        return await _service.GetAllStaffAsync();
    }

    [HttpPost("staff")]
    public async Task<ActionResult<HomeServiceStaff>> CreateStaff([FromBody] HomeServiceStaff staff)
    {
        var result = await _service.CreateStaffAsync(staff);
        return CreatedAtAction(nameof(GetAllStaff), result);
    }

    [HttpGet("daily-activity/{elderlyId}/{date}")]
    public async Task<ActionResult<DailyActivityRecord>> GetDailyActivity(string elderlyId, DateTime date)
    {
        return await _service.GetDailyActivityAsync(elderlyId, date);
    }

    [HttpPost("daily-activity")]
    public async Task<IActionResult> SaveDailyActivity([FromBody] DailyActivityRecord record)
    {
        await _service.SaveDailyActivityAsync(record);
        return Ok(new { message = "每日活动记录已保存" });
    }

    [HttpGet("visit-appointments")]
    public async Task<ActionResult<List<VisitAppointment>>> GetVisitAppointments([FromQuery] DateTime? date = null, [FromQuery] string? elderlyId = null)
    {
        return await _service.GetVisitAppointmentsAsync(date, elderlyId);
    }

    [HttpPost("visit-appointments")]
    public async Task<ActionResult<VisitAppointment>> CreateVisitAppointment([FromBody] VisitAppointment appointment)
    {
        try
        {
            var result = await _service.CreateVisitAppointmentAsync(appointment);
            return CreatedAtAction(nameof(GetVisitAppointments), new { date = result.VisitDate }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("visit-appointments/{appointmentId}/check-in")]
    public async Task<IActionResult> CheckInVisit(string appointmentId)
    {
        try
        {
            await _service.CheckInVisitAsync(appointmentId);
            return Ok(new { message = "探视签到成功" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("visit-appointments/{appointmentId}/check-out")]
    public async Task<IActionResult> CheckOutVisit(string appointmentId)
    {
        try
        {
            await _service.CheckOutVisitAsync(appointmentId);
            return Ok(new { message = "探视签退成功" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("visit-appointments/{appointmentId}/status")]
    public async Task<IActionResult> UpdateVisitAppointmentStatus(string appointmentId, [FromQuery] string status)
    {
        try
        {
            await _service.UpdateVisitAppointmentStatusAsync(appointmentId, status);
            return Ok(new { message = "预约状态已更新" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("family-notifications/{elderlyId}")]
    public async Task<ActionResult<List<FamilyNotification>>> GetFamilyNotifications(string elderlyId, [FromQuery] bool? isRead = null)
    {
        return await _service.GetFamilyNotificationsAsync(elderlyId, isRead);
    }

    [HttpPost("family-notifications/{elderlyId}")]
    public async Task<IActionResult> AddFamilyNotification(string elderlyId, [FromBody] FamilyNotification notification)
    {
        await _service.AddFamilyNotificationAsync(elderlyId, notification);
        return Ok(new { message = "通知已发送" });
    }

    [HttpPost("family-notifications/{notificationId}/read")]
    public async Task<IActionResult> MarkNotificationRead(string notificationId)
    {
        await _service.MarkNotificationReadAsync(notificationId);
        return Ok(new { message = "已标记为已读" });
    }

    [HttpPost("push-daily-summary")]
    public async Task<IActionResult> PushDailySummary([FromQuery] DateTime date)
    {
        await _service.PushDailySummaryAsync(date);
        return Ok(new { message = "每日摘要推送完成" });
    }

    [HttpPost("push-abnormal-alert/{elderlyId}")]
    public async Task<IActionResult> PushAbnormalAlert(string elderlyId, [FromQuery] string alertType, [FromQuery] string message, [FromQuery] string severity = "Warning")
    {
        await _service.PushAbnormalAlertAsync(elderlyId, alertType, message, severity);
        return Ok(new { message = "异常告警推送完成" });
    }

    [HttpGet("daily-order-count")]
    public async Task<ActionResult<int>> GetDailyOrderCount([FromQuery] DateTime date)
    {
        return await _service.GetDailyOrderCountAsync(date);
    }

    [HttpGet("completed-order-count")]
    public async Task<ActionResult<int>> GetCompletedOrderCount([FromQuery] DateTime date)
    {
        return await _service.GetCompletedOrderCountAsync(date);
    }

    [HttpGet("dashboard-stats")]
    [AllowAnonymous]
    public async Task<ActionResult<DashboardStats>> GetDashboardStats([FromQuery] string? facilityId = null)
    {
        return await _service.GetDashboardStatsAsync(facilityId);
    }

    [HttpGet("pending-dispatch")]
    public async Task<ActionResult<List<HomeServiceOrder>>> GetPendingDispatchOrders()
    {
        return await _service.GetPendingDispatchOrdersAsync();
    }

    [HttpPost("orders/{orderId}/satisfaction")]
    public async Task<IActionResult> UpdateSatisfaction(string orderId, [FromQuery] int score, [FromQuery] string? feedback = null)
    {
        try
        {
            await _service.UpdateSatisfactionAsync(orderId, score, feedback);
            return Ok(new { message = "满意度评价已提交" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
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
}

public class CheckOutRequest
{
    public ServiceRecord Record { get; set; } = new ServiceRecord();
    public List<ServicePhoto> Photos { get; set; } = new List<ServicePhoto>();
}
