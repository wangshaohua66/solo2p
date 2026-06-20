using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;
using FireTraining.Services;

namespace FireTraining.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrainingController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ISchedulingService _schedulingService;

    public TrainingController(AppDbContext context, ISchedulingService schedulingService)
    {
        _context = context;
        _schedulingService = schedulingService;
    }

    [HttpGet("courses")]
    public async Task<ActionResult<IEnumerable<Course>>> GetCourses(
        int? specialtyId,
        int? levelId,
        CourseType? type,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Courses
            .Include(c => c.Specialty)
            .Include(c => c.Level)
            .Where(c => c.IsActive)
            .AsQueryable();

        if (specialtyId.HasValue)
            query = query.Where(c => c.SpecialtyId == specialtyId.Value);

        if (levelId.HasValue)
            query = query.Where(c => c.LevelId == levelId.Value);

        if (type.HasValue)
            query = query.Where(c => c.Type == type.Value);

        if (!string.IsNullOrWhiteSpace(keyword))
            query = query.Where(c => c.Title.Contains(keyword));

        var total = await query.CountAsync(cancellationToken);
        var courses = await query
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Title)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Ok(new { total, data = courses });
    }

    [HttpGet("courses/{id}")]
    public async Task<ActionResult<Course>> GetCourse(int id, CancellationToken cancellationToken)
    {
        var course = await _context.Courses
            .Include(c => c.Specialty)
            .Include(c => c.Level)
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive, cancellationToken);

        if (course == null)
            return NotFound();

        return Ok(course);
    }

    [HttpPost("courses")]
    public async Task<ActionResult<Course>> CreateCourse(Course course, CancellationToken cancellationToken)
    {
        course.CreatedAt = DateTime.UtcNow;
        course.IsActive = true;

        _context.Courses.Add(course);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetCourse), new { id = course.Id }, course);
    }

    [HttpPut("courses/{id}")]
    public async Task<IActionResult> UpdateCourse(int id, Course course, CancellationToken cancellationToken)
    {
        if (id != course.Id)
            return BadRequest();

        var existing = await _context.Courses.FindAsync(new object[] { id }, cancellationToken);
        if (existing == null)
            return NotFound();

        existing.Title = course.Title;
        existing.Description = course.Description;
        existing.SpecialtyId = course.SpecialtyId;
        existing.LevelId = course.LevelId;
        existing.DurationHours = course.DurationHours;
        existing.Type = course.Type;
        existing.DefaultLocationType = course.DefaultLocationType;
        existing.Instructor = course.Instructor;
        existing.SortOrder = course.SortOrder;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("courses/{id}")]
    public async Task<IActionResult> DeleteCourse(int id, CancellationToken cancellationToken)
    {
        var course = await _context.Courses.FindAsync(new object[] { id }, cancellationToken);
        if (course == null)
            return NotFound();

        course.IsActive = false;
        course.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("plans")]
    public async Task<ActionResult<IEnumerable<TrainingPlan>>> GetTrainingPlans(
        int? specialtyId,
        int? levelId,
        PlanStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.TrainingPlans
            .Include(p => p.Level)
            .Include(p => p.PlanStations)
            .AsQueryable();

        if (specialtyId.HasValue)
            query = query.Where(p => p.SpecialtyId == specialtyId.Value);

        if (levelId.HasValue)
            query = query.Where(p => p.LevelId == levelId.Value);

        if (status.HasValue)
            query = query.Where(p => p.Status == status.Value);

        var total = await query.CountAsync(cancellationToken);
        var plans = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Ok(new { total, data = plans });
    }

    [HttpGet("plans/{id}")]
    public async Task<ActionResult<TrainingPlan>> GetTrainingPlan(int id, CancellationToken cancellationToken)
    {
        var plan = await _context.TrainingPlans
            .Include(p => p.Level)
            .Include(p => p.Schedules)
                .ThenInclude(s => s.Course)
            .Include(p => p.PlanStations)
                .ThenInclude(ps => ps.FireStation)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (plan == null)
            return NotFound();

        return Ok(plan);
    }

    [HttpPost("plans")]
    public async Task<ActionResult<TrainingPlan>> CreateTrainingPlan(TrainingPlan plan, CancellationToken cancellationToken)
    {
        plan.CreatedAt = DateTime.UtcNow;
        plan.Status = PlanStatus.Draft;

        _context.TrainingPlans.Add(plan);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetTrainingPlan), new { id = plan.Id }, plan);
    }

    [HttpGet("schedules/week")]
    public async Task<ActionResult<IEnumerable<TrainingSchedule>>> GetWeekSchedules(
        [FromQuery] DateTime weekStart,
        int? roomId,
        int? courseId,
        int? stationId,
        CancellationToken cancellationToken = default)
    {
        var schedules = await _schedulingService.GetWeekSchedulesAsync(weekStart, roomId, courseId, cancellationToken);

        if (stationId.HasValue)
        {
            schedules = schedules.Where(s =>
                s.Participants?.Any(p => p.Firefighter?.FireStationId == stationId.Value) == true
                || s.TrainingPlan?.PlanStations?.Any(ps => ps.FireStationId == stationId.Value) == true
            ).ToList();
        }

        return Ok(schedules);
    }

    [HttpGet("schedules/{id}")]
    public async Task<ActionResult<TrainingSchedule>> GetSchedule(int id, CancellationToken cancellationToken)
    {
        var schedule = await _context.TrainingSchedules
            .Include(s => s.Course)
            .Include(s => s.Room)
            .Include(s => s.Participants)
                .ThenInclude(p => p.Firefighter)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (schedule == null)
            return NotFound();

        return Ok(schedule);
    }

    [HttpPost("schedules")]
    public async Task<ActionResult<TrainingSchedule>> CreateSchedule(TrainingSchedule schedule, CancellationToken cancellationToken)
    {
        var conflicts = await _schedulingService.CheckConflictsAsync(schedule, cancellationToken);

        if (conflicts.Any())
        {
            return BadRequest(new { conflicts, message = "排课存在冲突" });
        }

        schedule.CreatedAt = DateTime.UtcNow;
        schedule.Status = ScheduleStatus.Scheduled;

        _context.TrainingSchedules.Add(schedule);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetSchedule), new { id = schedule.Id }, schedule);
    }

    [HttpPut("schedules/{id}")]
    public async Task<IActionResult> UpdateSchedule(int id, TrainingSchedule schedule, CancellationToken cancellationToken)
    {
        if (id != schedule.Id)
            return BadRequest();

        var conflicts = await _schedulingService.CheckConflictsAsync(schedule, cancellationToken);

        if (conflicts.Any(c => c.Schedule2Id != id))
        {
            return BadRequest(new { conflicts, message = "排课存在冲突" });
        }

        var existing = await _context.TrainingSchedules.FindAsync(new object[] { id }, cancellationToken);
        if (existing == null)
            return NotFound();

        existing.CourseId = schedule.CourseId;
        existing.RoomId = schedule.RoomId;
        existing.ScheduleDate = schedule.ScheduleDate;
        existing.DayOfWeek = schedule.DayOfWeek;
        existing.StartHour = schedule.StartHour;
        existing.StartMinute = schedule.StartMinute;
        existing.EndHour = schedule.EndHour;
        existing.EndMinute = schedule.EndMinute;
        existing.DurationMinutes = schedule.DurationMinutes;
        existing.Instructor = schedule.Instructor;
        existing.MaxParticipants = schedule.MaxParticipants;
        existing.Status = schedule.Status;
        existing.Notes = schedule.Notes;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("schedules/{id}")]
    public async Task<IActionResult> DeleteSchedule(int id, CancellationToken cancellationToken)
    {
        var schedule = await _context.TrainingSchedules.FindAsync(new object[] { id }, cancellationToken);
        if (schedule == null)
            return NotFound();

        schedule.Status = ScheduleStatus.Cancelled;
        schedule.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("schedules/conflicts/check")]
    public async Task<ActionResult<IEnumerable<ConflictResult>>> CheckConflicts(
        int roomId,
        DateTime scheduleDate,
        int startHour,
        int startMinute,
        int endHour,
        int endMinute,
        int? excludeScheduleId,
        CancellationToken cancellationToken)
    {
        var hasConflict = await _schedulingService.HasConflictAsync(
            roomId, scheduleDate, startHour, startMinute, endHour, endMinute, excludeScheduleId, cancellationToken);

        return Ok(new { hasConflict });
    }

    [HttpGet("schedules/conflicts/all")]
    public async Task<ActionResult<IEnumerable<ConflictResult>>> GetAllConflicts(
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate,
        CancellationToken cancellationToken)
    {
        var conflicts = await _schedulingService.CheckAllConflictsAsync(startDate, endDate, cancellationToken);
        return Ok(conflicts);
    }

    [HttpGet("schedules/suggestions")]
    public async Task<ActionResult<IEnumerable<SuggestionSlot>>> GetSuggestedSlots(
        int courseId,
        int roomType,
        [FromQuery] DateTime weekStart,
        CancellationToken cancellationToken)
    {
        var suggestions = await _schedulingService.GetSuggestedSlotsAsync(courseId, roomType, weekStart, cancellationToken);
        return Ok(suggestions);
    }

    [HttpPost("schedules/batch")]
    public async Task<ActionResult<BatchScheduleResult>> BatchSchedule(
        [FromBody] List<BatchScheduleItem> items,
        CancellationToken cancellationToken)
    {
        var result = await _schedulingService.BatchScheduleAsync(items, cancellationToken);
        return Ok(result);
    }

    [HttpPost("plans/{id}/auto-schedule")]
    public async Task<ActionResult<IEnumerable<TrainingSchedule>>> AutoSchedule(int id, CancellationToken cancellationToken)
    {
        var schedules = await _schedulingService.AutoScheduleAsync(id, cancellationToken);
        return Ok(schedules);
    }

    [HttpGet("rooms")]
    public async Task<ActionResult<IEnumerable<Room>>> GetRooms(
        RoomType? type,
        int? capacity,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Rooms
            .Where(r => r.IsActive)
            .AsQueryable();

        if (type.HasValue)
            query = query.Where(r => r.Type == type.Value);

        if (capacity.HasValue)
            query = query.Where(r => r.Capacity >= capacity.Value);

        if (!string.IsNullOrWhiteSpace(keyword))
            query = query.Where(r => r.Name.Contains(keyword));

        var rooms = await query
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);

        return Ok(rooms);
    }
}
