using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IScheduleService
{
    Task<List<ShiftSchedule>> GetAllAsync(string? facilityId = null);
    Task<ShiftSchedule?> GetByIdAsync(string id);
    Task<ShiftSchedule> CreateAsync(ShiftSchedule schedule);
    Task UpdateAsync(string id, ShiftSchedule schedule);
    Task DeleteAsync(string id);
    Task<List<ShiftSchedule>> GetByDateRangeAsync(DateTime startDate, DateTime endDate, string? facilityId = null);
    Task<List<ShiftSchedule>> GetByStaffAsync(string staffId, DateTime? startDate = null, DateTime? endDate = null);
    Task<List<ShiftSchedule>> GetByCareZoneAsync(string careZone, DateTime date, string? facilityId = null);
    Task<List<ScheduleConflict>> CheckConflictsAsync(string staffId, DateTime shiftDate, DateTime startTime, DateTime endTime, string? excludeScheduleId = null);
    Task<ShiftSchedule> CreateFromTemplateAsync(string staffId, string templateId, DateTime shiftDate, string? facilityId = null);
    Task<bool> RequestLeaveAsync(string scheduleId, LeaveRequest request);
    Task<bool> ApproveLeaveAsync(string requestId, bool approved, string approverId, string approverName, string? notes = null);
    Task<bool> RequestSwapAsync(string scheduleId, string targetStaffId, string targetScheduleId);
    Task<bool> ApproveSwapAsync(string scheduleId, bool approved);
    Task<bool> ClockInAsync(string scheduleId, string location);
    Task<bool> ClockOutAsync(string scheduleId, string location);
    Task<List<Staff>> GetAllStaffAsync(string? facilityId = null);
    Task<Staff> CreateStaffAsync(Staff staff);
    Task<List<ShiftTemplate>> GetAllTemplatesAsync();
    Task<ShiftTemplate> CreateTemplateAsync(ShiftTemplate template);
    Task<List<ShiftSchedule>> GenerateWeeklyScheduleAsync(DateTime weekStart, string? facilityId = null);
}

public class ScheduleService : IScheduleService
{
    private readonly IScheduleRepository _repository;

    public ScheduleService(IScheduleRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ShiftSchedule>> GetAllAsync(string? facilityId = null)
    {
        return await _repository.GetAllAsync(facilityId);
    }

    public async Task<ShiftSchedule?> GetByIdAsync(string id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<ShiftSchedule> CreateAsync(ShiftSchedule schedule)
    {
        var conflicts = await _repository.CheckConflictsAsync(
            schedule.StaffId, schedule.ShiftDate, schedule.StartTime, schedule.EndTime);
        if (conflicts.Any())
        {
            throw new InvalidOperationException($"排班冲突: {string.Join("; ", conflicts.Select(c => c.Description))}");
        }
        return await _repository.CreateAsync(schedule);
    }

    public async Task UpdateAsync(string id, ShiftSchedule schedule)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"排班 {id} 不存在");

        var conflicts = await _repository.CheckConflictsAsync(
            schedule.StaffId, schedule.ShiftDate, schedule.StartTime, schedule.EndTime, id);
        if (conflicts.Any())
        {
            throw new InvalidOperationException($"排班冲突: {string.Join("; ", conflicts.Select(c => c.Description))}");
        }

        schedule.Id = id;
        schedule.CreatedAt = existing.CreatedAt;
        await _repository.UpdateAsync(id, schedule);
    }

    public async Task DeleteAsync(string id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"排班 {id} 不存在");
        await _repository.DeleteAsync(id);
    }

    public async Task<List<ShiftSchedule>> GetByDateRangeAsync(DateTime startDate, DateTime endDate, string? facilityId = null)
    {
        return await _repository.GetByDateRangeAsync(startDate, endDate, facilityId);
    }

    public async Task<List<ShiftSchedule>> GetByStaffAsync(string staffId, DateTime? startDate = null, DateTime? endDate = null)
    {
        return await _repository.GetByStaffAsync(staffId, startDate, endDate);
    }

    public async Task<List<ShiftSchedule>> GetByCareZoneAsync(string careZone, DateTime date, string? facilityId = null)
    {
        return await _repository.GetByCareZoneAsync(careZone, date, facilityId);
    }

    public async Task<List<ScheduleConflict>> CheckConflictsAsync(string staffId, DateTime shiftDate, DateTime startTime, DateTime endTime, string? excludeScheduleId = null)
    {
        return await _repository.CheckConflictsAsync(staffId, shiftDate, startTime, endTime, excludeScheduleId);
    }

    public async Task<ShiftSchedule> CreateFromTemplateAsync(string staffId, string templateId, DateTime shiftDate, string? facilityId = null)
    {
        var templates = await _repository.GetAllTemplatesAsync();
        var template = templates.FirstOrDefault(t => t.Id == templateId);
        if (template == null) throw new KeyNotFoundException("班次模板不存在");

        var staffList = await _repository.GetAllStaffAsync(facilityId);
        var staff = staffList.FirstOrDefault(s => s.Id == staffId);
        if (staff == null) throw new KeyNotFoundException("员工不存在");

        var startTime = shiftDate.Date.Add(template.StartTime);
        var endTime = shiftDate.Date.Add(template.EndTime);
        if (template.EndTime < template.StartTime) endTime = endTime.AddDays(1);

        var schedule = new ShiftSchedule
        {
            StaffId = staffId,
            StaffName = staff.Name,
            Position = staff.Position,
            Skills = staff.Skills,
            ShiftType = template.ShiftType,
            ShiftDate = shiftDate.Date,
            StartTime = startTime,
            EndTime = endTime,
            BreakMinutes = template.BreakMinutes,
            TemplateId = templateId,
            CareZone = staff.CareZone,
            FacilityId = facilityId ?? staff.FacilityId,
            Status = "Scheduled"
        };

        return await CreateAsync(schedule);
    }

    public async Task<bool> RequestLeaveAsync(string scheduleId, LeaveRequest request)
    {
        var schedule = await _repository.GetByIdAsync(scheduleId);
        if (schedule == null) throw new KeyNotFoundException("排班不存在");

        request.RequestId = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        request.StaffId = schedule.StaffId;
        request.StaffName = schedule.StaffName;
        request.CreatedAt = DateTime.UtcNow;
        request.Status = "Pending";
        schedule.LeaveRequests.Add(request);
        schedule.Status = "LeavePending";
        schedule.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(scheduleId, schedule);
        return true;
    }

    public async Task<bool> ApproveLeaveAsync(string requestId, bool approved, string approverId, string approverName, string? notes = null)
    {
        var request = await _repository.GetLeaveRequestByIdAsync(requestId);
        if (request == null) throw new KeyNotFoundException("请假申请不存在");

        request.Status = approved ? "Approved" : "Rejected";
        request.ApproverId = approverId;
        request.ApproverName = approverName;
        request.ApprovalDate = DateTime.UtcNow;
        request.ApprovalNotes = notes;

        await _repository.UpdateLeaveRequestAsync(requestId, request);
        return true;
    }

    public async Task<bool> RequestSwapAsync(string scheduleId, string targetStaffId, string targetScheduleId)
    {
        var schedule = await _repository.GetByIdAsync(scheduleId);
        if (schedule == null) throw new KeyNotFoundException("原排班不存在");

        var targetSchedule = await _repository.GetByIdAsync(targetScheduleId);
        if (targetSchedule == null) throw new KeyNotFoundException("目标排班不存在");

        if (targetSchedule.StaffId != targetStaffId) throw new InvalidOperationException("目标排班与目标员工不匹配");

        schedule.IsSwapPending = true;
        schedule.SwapWithScheduleId = targetScheduleId;
        schedule.SwapWithStaffId = targetStaffId;
        schedule.SwapWithStaffName = targetSchedule.StaffName;
        schedule.UpdatedAt = DateTime.UtcNow;
        schedule.Status = "SwapPending";
        await _repository.UpdateAsync(scheduleId, schedule);
        return true;
    }

    public async Task<bool> ApproveSwapAsync(string scheduleId, bool approved)
    {
        var schedule = await _repository.GetByIdAsync(scheduleId);
        if (schedule == null) throw new KeyNotFoundException("原排班不存在");
        if (!schedule.IsSwapPending) throw new InvalidOperationException("该排班没有待审批的调班申请");

        if (approved && !string.IsNullOrEmpty(schedule.SwapWithScheduleId))
        {
            var targetSchedule = await _repository.GetByIdAsync(schedule.SwapWithScheduleId);
            if (targetSchedule == null) throw new KeyNotFoundException("目标排班不存在");

            var originalStaffId = schedule.StaffId;
            var originalStaffName = schedule.StaffName;
            var originalPosition = schedule.Position;
            var originalSkills = schedule.Skills;

            schedule.StaffId = targetSchedule.StaffId;
            schedule.StaffName = targetSchedule.StaffName;
            schedule.Position = targetSchedule.Position;
            schedule.Skills = targetSchedule.Skills;

            targetSchedule.StaffId = originalStaffId;
            targetSchedule.StaffName = originalStaffName;
            targetSchedule.Position = originalPosition;
            targetSchedule.Skills = originalSkills;

            schedule.IsSwapPending = false;
            schedule.SwapWithScheduleId = null;
            schedule.SwapWithStaffId = null;
            schedule.SwapWithStaffName = null;
            schedule.Status = "Scheduled";
            schedule.UpdatedAt = DateTime.UtcNow;

            targetSchedule.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(scheduleId, schedule);
            await _repository.UpdateAsync(targetSchedule.Id, targetSchedule);
        }
        else
        {
            schedule.IsSwapPending = false;
            schedule.SwapWithScheduleId = null;
            schedule.SwapWithStaffId = null;
            schedule.SwapWithStaffName = null;
            schedule.Status = "Scheduled";
            schedule.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(scheduleId, schedule);
        }
        return true;
    }

    public async Task<bool> ClockInAsync(string scheduleId, string location)
    {
        var schedule = await _repository.GetByIdAsync(scheduleId);
        if (schedule == null) throw new KeyNotFoundException("排班不存在");
        if (schedule.ClockInTime.HasValue) throw new InvalidOperationException("已打卡上班");

        schedule.ClockInTime = DateTime.UtcNow;
        schedule.ClockInLocation = location;
        schedule.Status = "OnDuty";
        schedule.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(scheduleId, schedule);
        return true;
    }

    public async Task<bool> ClockOutAsync(string scheduleId, string location)
    {
        var schedule = await _repository.GetByIdAsync(scheduleId);
        if (schedule == null) throw new KeyNotFoundException("排班不存在");
        if (!schedule.ClockInTime.HasValue) throw new InvalidOperationException("尚未打卡上班");
        if (schedule.ClockOutTime.HasValue) throw new InvalidOperationException("已打卡下班");

        schedule.ClockOutTime = DateTime.UtcNow;
        schedule.ClockOutLocation = location;
        schedule.Status = "Completed";
        schedule.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(scheduleId, schedule);
        return true;
    }

    public async Task<List<Staff>> GetAllStaffAsync(string? facilityId = null)
    {
        return await _repository.GetAllStaffAsync(facilityId);
    }

    public async Task<Staff> CreateStaffAsync(Staff staff)
    {
        return await _repository.CreateStaffAsync(staff);
    }

    public async Task<List<ShiftTemplate>> GetAllTemplatesAsync()
    {
        return await _repository.GetAllTemplatesAsync();
    }

    public async Task<ShiftTemplate> CreateTemplateAsync(ShiftTemplate template)
    {
        return await _repository.CreateTemplateAsync(template);
    }

    public async Task<List<ShiftSchedule>> GenerateWeeklyScheduleAsync(DateTime weekStart, string? facilityId = null)
    {
        var generated = new List<ShiftSchedule>();
        return generated;
    }
}
