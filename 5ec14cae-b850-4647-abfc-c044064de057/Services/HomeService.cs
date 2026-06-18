using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IHomeService
{
    Task<List<HomeServiceOrder>> GetAllOrdersAsync();
    Task<HomeServiceOrder?> GetOrderByIdAsync(string id);
    Task<HomeServiceOrder> CreateOrderAsync(HomeServiceOrder order);
    Task UpdateOrderAsync(string id, HomeServiceOrder order);
    Task DeleteOrderAsync(string id);
    Task<List<HomeServiceOrder>> GetOrdersByStatusAsync(string status);
    Task<List<HomeServiceOrder>> GetOrdersByElderlyIdAsync(string elderlyId);
    Task<List<HomeServiceOrder>> GetOrdersByDateRangeAsync(DateTime startDate, DateTime endDate);
    Task<List<HomeServiceStaff>> GetAvailableStaffAsync(string serviceType, string area, DateTime date, TimeSpan startTime, TimeSpan endTime);
    Task<bool> AssignStaffAsync(string orderId, string staffId);
    Task<bool> DispatchOrderAsync(string orderId, string dispatchNote, string? staffId = null);
    Task<bool> CheckInAsync(string orderId, double latitude, double longitude, string location);
    Task<bool> CheckOutAsync(string orderId, ServiceRecord record, List<ServicePhoto> photos);
    Task<bool> CancelOrderAsync(string orderId, string reason, string cancelledBy);
    Task<bool> UpdateOrderStatusAsync(string orderId, string status, string? note = null);
    Task<List<HomeServiceStaff>> GetAllStaffAsync();
    Task<HomeServiceStaff> CreateStaffAsync(HomeServiceStaff staff);
    Task<DailyActivityRecord> GetDailyActivityAsync(string elderlyId, DateTime date);
    Task SaveDailyActivityAsync(DailyActivityRecord record);
    Task<List<VisitAppointment>> GetVisitAppointmentsAsync(DateTime? date = null, string? elderlyId = null);
    Task<VisitAppointment> CreateVisitAppointmentAsync(VisitAppointment appointment);
    Task<bool> CheckInVisitAsync(string appointmentId);
    Task<bool> CheckOutVisitAsync(string appointmentId);
    Task<bool> UpdateVisitAppointmentStatusAsync(string appointmentId, string status);
    Task<List<FamilyNotification>> GetFamilyNotificationsAsync(string elderlyId, bool? isRead = null);
    Task<bool> AddFamilyNotificationAsync(string elderlyId, FamilyNotification notification);
    Task<bool> MarkNotificationReadAsync(string notificationId);
    Task<bool> PushDailySummaryAsync(DateTime date);
    Task<bool> PushAbnormalAlertAsync(string elderlyId, string alertType, string message, string severity = "Warning");
    Task<int> GetDailyOrderCountAsync(DateTime date);
    Task<int> GetCompletedOrderCountAsync(DateTime date);
    Task<DashboardStats> GetDashboardStatsAsync(string? facilityId = null);
    Task<List<HomeServiceOrder>> GetPendingDispatchOrdersAsync();
    Task<bool> UpdateSatisfactionAsync(string orderId, int score, string? feedback = null);
}

public class HomeService : IHomeService
{
    private readonly IHomeServiceRepository _repository;

    public HomeService(IHomeServiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<HomeServiceOrder>> GetAllOrdersAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<HomeServiceOrder?> GetOrderByIdAsync(string id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<HomeServiceOrder> CreateOrderAsync(HomeServiceOrder order)
    {
        if (order.ScheduledEndTime <= order.ScheduledStartTime)
            throw new ArgumentException("结束时间必须晚于开始时间");
        order.Status = "Pending";
        return await _repository.CreateAsync(order);
    }

    public async Task UpdateOrderAsync(string id, HomeServiceOrder order)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException("订单不存在");
        if (existing.Status == "Completed" || existing.Status == "Cancelled")
            throw new InvalidOperationException($"订单状态为 {existing.Status}，无法修改");
        order.Id = id;
        order.CreatedAt = existing.CreatedAt;
        await _repository.UpdateAsync(id, order);
    }

    public async Task DeleteOrderAsync(string id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException("订单不存在");
        if (existing.Status != "Pending")
            throw new InvalidOperationException("只有待派单状态的订单可以删除");
        await _repository.DeleteAsync(id);
    }

    public async Task<List<HomeServiceOrder>> GetOrdersByStatusAsync(string status)
    {
        return await _repository.GetByStatusAsync(status);
    }

    public async Task<List<HomeServiceOrder>> GetOrdersByElderlyIdAsync(string elderlyId)
    {
        return await _repository.GetByElderlyIdAsync(elderlyId);
    }

    public async Task<List<HomeServiceOrder>> GetOrdersByDateRangeAsync(DateTime startDate, DateTime endDate)
    {
        return await _repository.GetByDateRangeAsync(startDate, endDate);
    }

    public async Task<List<HomeServiceStaff>> GetAvailableStaffAsync(string serviceType, string area, DateTime date, TimeSpan startTime, TimeSpan endTime)
    {
        return await _repository.GetAvailableStaffAsync(serviceType, area, date, startTime, endTime);
    }

    public async Task<bool> AssignStaffAsync(string orderId, string staffId)
    {
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status != "Pending") throw new InvalidOperationException("订单不是待派单状态");

        var staffList = await _repository.GetAllStaffAsync();
        var staff = staffList.FirstOrDefault(s => s.Id == staffId);
        if (staff == null) throw new KeyNotFoundException("服务人员不存在");

        await _repository.AssignStaffAsync(orderId, staffId, staff.Name, staff.Phone);
        return true;
    }

    public async Task<bool> DispatchOrderAsync(string orderId, string dispatchNote, string? staffId = null)
    {
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status != "Pending") throw new InvalidOperationException("订单不是待派单状态");

        if (!string.IsNullOrEmpty(staffId))
        {
            await AssignStaffAsync(orderId, staffId);
        }
        else if (string.IsNullOrEmpty(order.AssignedStaffId))
        {
            throw new InvalidOperationException("请先分配服务人员");
        }

        var updatedOrder = await _repository.GetByIdAsync(orderId);
        if (updatedOrder != null)
        {
            updatedOrder.DispatchNote = dispatchNote;
            updatedOrder.Status = "Dispatched";
            updatedOrder.DispatchedAt = DateTime.UtcNow;
            updatedOrder.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(orderId, updatedOrder);
        }
        return true;
    }

    public async Task<bool> CheckInAsync(string orderId, double latitude, double longitude, string location)
    {
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status != "Dispatched" && order.Status != "InProgress")
            throw new InvalidOperationException($"订单状态为 {order.Status}，无法签到");
        if (order.CheckInTime.HasValue)
            throw new InvalidOperationException("已经签到过了");

        await _repository.CheckInAsync(orderId, latitude, longitude, location);
        return true;
    }

    public async Task<bool> CheckOutAsync(string orderId, ServiceRecord record, List<ServicePhoto> photos)
    {
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status != "InProgress")
            throw new InvalidOperationException($"订单状态为 {order.Status}，无法签退");
        if (!order.CheckInTime.HasValue)
            throw new InvalidOperationException("还未签到，无法签退");

        await _repository.CheckOutAsync(orderId, record, photos);
        return true;
    }

    public async Task<bool> CancelOrderAsync(string orderId, string reason, string cancelledBy)
    {
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status == "Completed")
            throw new InvalidOperationException("已完成的订单无法取消");
        if (order.Status == "Cancelled")
            throw new InvalidOperationException("订单已取消");

        await _repository.UpdateOrderStatusAsync(orderId, "Cancelled", reason);
        var updated = await _repository.GetByIdAsync(orderId);
        if (updated != null)
        {
            updated.CancelledBy = cancelledBy;
            updated.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(orderId, updated);
        }
        return true;
    }

    public async Task<bool> UpdateOrderStatusAsync(string orderId, string status, string? note = null)
    {
        await _repository.UpdateOrderStatusAsync(orderId, status, note);
        return true;
    }

    public async Task<List<HomeServiceStaff>> GetAllStaffAsync()
    {
        return await _repository.GetAllStaffAsync();
    }

    public async Task<HomeServiceStaff> CreateStaffAsync(HomeServiceStaff staff)
    {
        return await _repository.CreateStaffAsync(staff);
    }

    public async Task<DailyActivityRecord> GetDailyActivityAsync(string elderlyId, DateTime date)
    {
        return await _repository.GetDailyActivityAsync(elderlyId, date);
    }

    public async Task SaveDailyActivityAsync(DailyActivityRecord record)
    {
        await _repository.SaveDailyActivityAsync(record);
    }

    public async Task<List<VisitAppointment>> GetVisitAppointmentsAsync(DateTime? date = null, string? elderlyId = null)
    {
        return await _repository.GetVisitAppointmentsAsync(date, elderlyId);
    }

    public async Task<VisitAppointment> CreateVisitAppointmentAsync(VisitAppointment appointment)
    {
        if (appointment.EndTime <= appointment.StartTime)
            throw new ArgumentException("结束时间必须晚于开始时间");
        appointment.Status = "Confirmed";
        return await _repository.CreateVisitAppointmentAsync(appointment);
    }

    public async Task<bool> CheckInVisitAsync(string appointmentId)
    {
        await _repository.UpdateVisitAppointmentStatusAsync(appointmentId, "Visiting", DateTime.UtcNow);
        return true;
    }

    public async Task<bool> CheckOutVisitAsync(string appointmentId)
    {
        await _repository.UpdateVisitAppointmentStatusAsync(appointmentId, "Completed", null, DateTime.UtcNow);
        return true;
    }

    public async Task<bool> UpdateVisitAppointmentStatusAsync(string appointmentId, string status)
    {
        await _repository.UpdateVisitAppointmentStatusAsync(appointmentId, status);
        return true;
    }

    public async Task<List<FamilyNotification>> GetFamilyNotificationsAsync(string elderlyId, bool? isRead = null)
    {
        return await _repository.GetFamilyNotificationsAsync(elderlyId, isRead);
    }

    public async Task<bool> AddFamilyNotificationAsync(string elderlyId, FamilyNotification notification)
    {
        await _repository.AddFamilyNotificationAsync(elderlyId, notification);
        return true;
    }

    public async Task<bool> MarkNotificationReadAsync(string notificationId)
    {
        await _repository.MarkNotificationReadAsync(notificationId);
        return true;
    }

    public async Task<bool> PushDailySummaryAsync(DateTime date)
    {
        return true;
    }

    public async Task<bool> PushAbnormalAlertAsync(string elderlyId, string alertType, string message, string severity = "Warning")
    {
        var notification = new FamilyNotification
        {
            Type = alertType,
            Title = alertType switch
            {
                "HealthAbnormal" => "健康异常提醒",
                "MedicationMissed" => "漏服药提醒",
                "FallDetected" => "跌倒告警",
                _ => "系统通知"
            },
            Content = message,
            Severity = severity
        };
        await AddFamilyNotificationAsync(elderlyId, notification);
        return true;
    }

    public async Task<int> GetDailyOrderCountAsync(DateTime date)
    {
        return await _repository.GetDailyOrderCountAsync(date);
    }

    public async Task<int> GetCompletedOrderCountAsync(DateTime date)
    {
        return await _repository.GetCompletedOrderCountAsync(date);
    }

    public async Task<DashboardStats> GetDashboardStatsAsync(string? facilityId = null)
    {
        return await _repository.GetDashboardStatsAsync(facilityId);
    }

    public async Task<List<HomeServiceOrder>> GetPendingDispatchOrdersAsync()
    {
        return await _repository.GetPendingDispatchOrdersAsync();
    }

    public async Task<bool> UpdateSatisfactionAsync(string orderId, int score, string? feedback = null)
    {
        if (score < 1 || score > 5) throw new ArgumentException("评分必须在1-5之间");
        var order = await _repository.GetByIdAsync(orderId);
        if (order == null) throw new KeyNotFoundException("订单不存在");
        if (order.Status != "Completed") throw new InvalidOperationException("只能对已完成的订单评价");

        order.SatisfactionScore = score;
        order.Feedback = feedback;
        order.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(orderId, order);
        return true;
    }
}
