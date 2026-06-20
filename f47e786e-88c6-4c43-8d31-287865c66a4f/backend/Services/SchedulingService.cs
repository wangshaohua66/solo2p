using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;
using FireTraining.Common;

namespace FireTraining.Services;

public interface ISchedulingService
{
    Task<List<ConflictResult>> CheckConflictsAsync(TrainingSchedule schedule, CancellationToken cancellationToken = default);
    Task<List<ConflictResult>> CheckAllConflictsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<bool> HasConflictAsync(int roomId, DateTime scheduleDate, int startHour, int startMinute, int endHour, int endMinute, int? excludeScheduleId = null, CancellationToken cancellationToken = default);
    Task<List<SuggestionSlot>> GetSuggestedSlotsAsync(int courseId, int roomType, DateTime weekStart, CancellationToken cancellationToken = default);
    Task<List<TrainingSchedule>> AutoScheduleAsync(int trainingPlanId, CancellationToken cancellationToken = default);
    Task<List<TrainingSchedule>> GetWeekSchedulesAsync(DateTime weekStart, int? roomId = null, int? courseId = null, CancellationToken cancellationToken = default);
    Task<BatchScheduleResult> BatchScheduleAsync(List<BatchScheduleItem> items, CancellationToken cancellationToken = default);
}

public class SchedulingService : ISchedulingService
{
    private readonly AppDbContext _context;

    public SchedulingService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<ConflictResult>> CheckConflictsAsync(TrainingSchedule schedule, CancellationToken cancellationToken = default)
    {
        var conflicts = new List<ConflictResult>();

        var roomConflict = await CheckRoomConflictAsync(schedule, cancellationToken);
        if (roomConflict != null)
        {
            conflicts.Add(roomConflict);
        }

        var participantConflicts = await CheckParticipantConflictsAsync(schedule, cancellationToken);
        conflicts.AddRange(participantConflicts);

        return conflicts;
    }

    public async Task<List<ConflictResult>> CheckAllConflictsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var conflicts = new List<ConflictResult>();

        var schedules = await _context.TrainingSchedules
            .Include(s => s.Course)
            .Include(s => s.Room)
            .Where(s => s.ScheduleDate >= startDate && s.ScheduleDate <= endDate && s.Status != ScheduleStatus.Cancelled)
            .ToListAsync(cancellationToken);

        for (int i = 0; i < schedules.Count; i++)
        {
            for (int j = i + 1; j < schedules.Count; j++)
            {
                var s1 = schedules[i];
                var s2 = schedules[j];

                if (s1.ScheduleDate != s2.ScheduleDate)
                    continue;

                if (s1.RoomId == s2.RoomId && TimeOverlapsMinutes(s1, s2))
                {
                    conflicts.Add(new ConflictResult
                    {
                        Type = ConflictType.Room,
                        Schedule1Id = s1.Id,
                        Schedule2Id = s2.Id,
                        Schedule1Title = s1.Course?.Title ?? "Unknown",
                        Schedule2Title = s2.Course?.Title ?? "Unknown",
                        Description = $"场地冲突：{s1.Room?.Name ?? "Unknown"}在{AppCommon.GetDayName(((int)s1.ScheduleDate.DayOfWeek + 6) % 7)}存在时间重叠"
                    });
                }

                var participants1 = await _context.ScheduleParticipants
                    .Where(p => p.TrainingScheduleId == s1.Id && p.Status == ParticipantStatus.Enrolled)
                    .Select(p => p.FirefighterId)
                    .ToListAsync(cancellationToken);

                var participants2 = await _context.ScheduleParticipants
                    .Where(p => p.TrainingScheduleId == s2.Id && p.Status == ParticipantStatus.Enrolled)
                    .Select(p => p.FirefighterId)
                    .ToListAsync(cancellationToken);

                var common = participants1.Intersect(participants2).ToList();
                if (common.Any() && TimeOverlapsMinutes(s1, s2))
                {
                    conflicts.Add(new ConflictResult
                    {
                        Type = ConflictType.Participant,
                        Schedule1Id = s1.Id,
                        Schedule2Id = s2.Id,
                        Schedule1Title = s1.Course?.Title ?? "Unknown",
                        Schedule2Title = s2.Course?.Title ?? "Unknown",
                        Description = $"人员冲突：{common.Count}名参训人员时间重叠",
                        ConflictingCount = common.Count
                    });
                }
            }
        }

        return conflicts;
    }

    public async Task<bool> HasConflictAsync(int roomId, DateTime scheduleDate, int startHour, int startMinute, int endHour, int endMinute, int? excludeScheduleId = null, CancellationToken cancellationToken = default)
    {
        var newStartMinutes = startHour * 60 + startMinute;
        var newEndMinutes = endHour * 60 + endMinute;

        var query = _context.TrainingSchedules
            .Where(s => s.RoomId == roomId
                && s.ScheduleDate == scheduleDate.Date
                && s.Status != ScheduleStatus.Cancelled
                && (s.StartHour * 60 + s.StartMinute) < newEndMinutes
                && (s.EndHour * 60 + s.EndMinute) > newStartMinutes);

        if (excludeScheduleId.HasValue)
        {
            query = query.Where(s => s.Id != excludeScheduleId.Value);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<List<SuggestionSlot>> GetSuggestedSlotsAsync(int courseId, int roomType, DateTime weekStart, CancellationToken cancellationToken = default)
    {
        var course = await _context.Courses.FindAsync(new object[] { courseId }, cancellationToken);
        if (course == null)
            return new List<SuggestionSlot>();

        var durationHours = course.DurationHours;
        var rooms = await _context.Rooms
            .Where(r => r.IsActive && r.Type == (RoomType)roomType)
            .ToListAsync(cancellationToken);

        var suggestions = new List<SuggestionSlot>();
        var weekEnd = weekStart.AddDays(7);

        var existingSchedules = await _context.TrainingSchedules
            .Where(s => s.ScheduleDate >= weekStart.Date && s.ScheduleDate < weekEnd.Date && s.Status != ScheduleStatus.Cancelled)
            .ToListAsync(cancellationToken);

        foreach (var room in rooms)
        {
            for (int day = 0; day < 7; day++)
            {
                var date = weekStart.AddDays(day);
                if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                    continue;

                var roomSchedules = existingSchedules
                    .Where(s => s.RoomId == room.Id && s.ScheduleDate.Date == date.Date)
                    .OrderBy(s => s.StartHour)
                    .ToList();

                for (int hour = 8; hour + durationHours <= 18; hour++)
                {
                    var hasConflict = roomSchedules.Any(s =>
                        s.StartHour < hour + durationHours && s.EndHour > hour);

                    if (!hasConflict)
                    {
                        suggestions.Add(new SuggestionSlot
                        {
                            RoomId = room.Id,
                            RoomName = room.Name,
                            Date = date,
                            DayOfWeek = (int)date.DayOfWeek,
                            StartHour = hour,
                            EndHour = hour + durationHours,
                            Score = CalculateSlotScore(room, hour, day)
                        });
                    }
                }
            }
        }

        return suggestions.OrderByDescending(s => s.Score).Take(20).ToList();
    }

    public async Task<List<TrainingSchedule>> AutoScheduleAsync(int trainingPlanId, CancellationToken cancellationToken = default)
    {
        var plan = await _context.TrainingPlans
            .Include(p => p.Schedules)
            .Include(p => p.PlanStations)
            .FirstOrDefaultAsync(p => p.Id == trainingPlanId, cancellationToken);

        if (plan == null)
            return new List<TrainingSchedule>();

        var courses = await _context.Courses
            .Where(c => c.SpecialtyId == plan.SpecialtyId && c.LevelId == plan.LevelId && c.IsActive)
            .ToListAsync(cancellationToken);

        var rooms = await _context.Rooms
            .Where(r => r.IsActive)
            .ToListAsync(cancellationToken);

        var scheduled = new List<TrainingSchedule>();
        var currentDate = plan.StartDate;

        foreach (var course in courses)
        {
            var scheduledCourse = false;
            var maxAttempts = 30;
            var attempts = 0;

            while (!scheduledCourse && attempts < maxAttempts)
            {
                var roomType = course.DefaultLocationType == LocationType.Classroom ? RoomType.Classroom : RoomType.TrainingField;
                var availableRooms = rooms.Where(r => r.Type == roomType || r.Type == RoomType.MultiPurpose).ToList();

                foreach (var room in availableRooms)
                {
                    for (int hour = 8; hour + course.DurationHours <= 18 && !scheduledCourse; hour++)
                    {
                        var hasConflict = await HasConflictAsync(
                            room.Id, currentDate, hour, 0, hour + course.DurationHours, 0,
                            cancellationToken: cancellationToken);

                        if (!hasConflict)
                        {
                            var schedule = new TrainingSchedule
                            {
                                TrainingPlanId = trainingPlanId,
                                CourseId = course.Id,
                                RoomId = room.Id,
                                ScheduleDate = currentDate.Date,
                                DayOfWeek = (int)currentDate.DayOfWeek,
                                StartHour = hour,
                                StartMinute = 0,
                                EndHour = hour + course.DurationHours,
                                EndMinute = 0,
                                DurationMinutes = course.DurationHours * 60,
                                Status = ScheduleStatus.Scheduled,
                                Instructor = course.Instructor,
                                MaxParticipants = room.Capacity,
                                CreatedAt = DateTime.UtcNow
                            };

                            _context.TrainingSchedules.Add(schedule);
                            scheduled.Add(schedule);
                            scheduledCourse = true;
                        }
                    }
                }

                if (!scheduledCourse)
                {
                    currentDate = currentDate.AddDays(1);
                    attempts++;
                }
            }

            if (scheduledCourse)
            {
                currentDate = currentDate.AddDays(1);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return scheduled;
    }

    public async Task<List<TrainingSchedule>> GetWeekSchedulesAsync(DateTime weekStart, int? roomId = null, int? courseId = null, CancellationToken cancellationToken = default)
    {
        var weekEnd = weekStart.AddDays(7);
        var query = _context.TrainingSchedules
            .Include(s => s.Course)
            .Include(s => s.Room)
            .Include(s => s.Participants)
            .Where(s => s.ScheduleDate >= weekStart.Date && s.ScheduleDate < weekEnd.Date && s.Status != ScheduleStatus.Cancelled);

        if (roomId.HasValue)
        {
            query = query.Where(s => s.RoomId == roomId.Value);
        }

        if (courseId.HasValue)
        {
            query = query.Where(s => s.CourseId == courseId.Value);
        }

        return await query
            .OrderBy(s => s.ScheduleDate)
            .ThenBy(s => s.StartHour)
            .ToListAsync(cancellationToken);
    }

    public async Task<BatchScheduleResult> BatchScheduleAsync(List<BatchScheduleItem> items, CancellationToken cancellationToken = default)
    {
        var result = new BatchScheduleResult();
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            foreach (var item in items)
            {
                var course = await _context.Courses.FindAsync(new object[] { item.CourseId }, cancellationToken);
                if (course == null)
                {
                    result.FailedItems.Add(new FailedScheduleItem
                    {
                        CourseId = item.CourseId,
                        Reason = "课程不存在"
                    });
                    continue;
                }

                var hasConflict = await HasConflictAsync(
                    item.RoomId,
                    item.ScheduleDate,
                    item.StartHour,
                    item.StartMinute,
                    item.EndHour,
                    item.EndMinute,
                    cancellationToken: cancellationToken);

                if (hasConflict)
                {
                    result.FailedItems.Add(new FailedScheduleItem
                    {
                        CourseId = item.CourseId,
                        Reason = "时间冲突"
                    });
                    continue;
                }

                var schedule = new TrainingSchedule
                {
                    TrainingPlanId = item.TrainingPlanId,
                    CourseId = item.CourseId,
                    RoomId = item.RoomId,
                    ScheduleDate = item.ScheduleDate.Date,
                    DayOfWeek = (int)item.ScheduleDate.DayOfWeek,
                    StartHour = item.StartHour,
                    StartMinute = item.StartMinute,
                    EndHour = item.EndHour,
                    EndMinute = item.EndMinute,
                    DurationMinutes = (item.EndHour - item.StartHour) * 60 + (item.EndMinute - item.StartMinute),
                    Status = ScheduleStatus.Scheduled,
                    Notes = item.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                _context.TrainingSchedules.Add(schedule);
                result.ScheduledCount++;
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return result;
    }

    private async Task<ConflictResult?> CheckRoomConflictAsync(TrainingSchedule schedule, CancellationToken cancellationToken)
    {
        var hasConflict = await HasConflictAsync(
            schedule.RoomId,
            schedule.ScheduleDate,
            schedule.StartHour,
            schedule.StartMinute,
            schedule.EndHour,
            schedule.EndMinute,
            schedule.Id > 0 ? schedule.Id : null,
            cancellationToken);

        if (!hasConflict) return null;

        var scheduleStartMinutes = schedule.StartHour * 60 + schedule.StartMinute;
        var scheduleEndMinutes = schedule.EndHour * 60 + schedule.EndMinute;

        var conflictingSchedule = await _context.TrainingSchedules
            .Include(s => s.Course)
            .FirstOrDefaultAsync(s =>
                s.RoomId == schedule.RoomId
                && s.ScheduleDate == schedule.ScheduleDate.Date
                && s.Id != schedule.Id
                && s.Status != ScheduleStatus.Cancelled
                && (s.StartHour * 60 + s.StartMinute) < scheduleEndMinutes
                && (s.EndHour * 60 + s.EndMinute) > scheduleStartMinutes,
                cancellationToken);

        return new ConflictResult
        {
            Type = ConflictType.Room,
            Schedule1Id = schedule.Id,
            Schedule2Id = conflictingSchedule?.Id ?? 0,
            Schedule1Title = schedule.Course?.Title ?? "",
            Schedule2Title = conflictingSchedule?.Course?.Title ?? "未知课程",
            Description = $"与「{conflictingSchedule?.Course?.Title ?? "未知课程"}」在{schedule.ScheduleDate:yyyy-MM-dd}时间冲突"
        };
    }

    private async Task<List<ConflictResult>> CheckParticipantConflictsAsync(TrainingSchedule schedule, CancellationToken cancellationToken)
    {
        var conflicts = new List<ConflictResult>();

        var participantIds = await _context.ScheduleParticipants
            .Where(p => p.TrainingScheduleId == schedule.Id && p.Status == ParticipantStatus.Enrolled)
            .Select(p => p.FirefighterId)
            .ToListAsync(cancellationToken);

        if (!participantIds.Any())
            return conflicts;

        var scheduleStartMinutes = schedule.StartHour * 60 + schedule.StartMinute;
        var scheduleEndMinutes = schedule.EndHour * 60 + schedule.EndMinute;

        var overlappingSchedules = await _context.TrainingSchedules
            .Include(s => s.Course)
            .Where(s =>
                s.Id != schedule.Id
                && s.ScheduleDate == schedule.ScheduleDate.Date
                && s.Status != ScheduleStatus.Cancelled
                && (s.StartHour * 60 + s.StartMinute) < scheduleEndMinutes
                && (s.EndHour * 60 + s.EndMinute) > scheduleStartMinutes)
            .ToListAsync(cancellationToken);

        foreach (var overlapping in overlappingSchedules)
        {
            var overlappingParticipants = await _context.ScheduleParticipants
                .Where(p => p.TrainingScheduleId == overlapping.Id && p.Status == ParticipantStatus.Enrolled && participantIds.Contains(p.FirefighterId))
                .CountAsync(cancellationToken);

            if (overlappingParticipants > 0)
            {
                conflicts.Add(new ConflictResult
                {
                    Type = ConflictType.Participant,
                    Schedule1Id = schedule.Id,
                    Schedule2Id = overlapping.Id,
                    Schedule1Title = schedule.Course?.Title ?? "",
                    Schedule2Title = overlapping.Course?.Title ?? "未知课程",
                    Description = $"与「{overlapping.Course?.Title ?? "未知课程"}」有{overlappingParticipants}名参训人员冲突",
                    ConflictingCount = overlappingParticipants
                });
            }
        }

        return conflicts;
    }

    private static bool TimeOverlapsMinutes(TrainingSchedule s1, TrainingSchedule s2)
    {
        var s1Start = s1.StartHour * 60 + s1.StartMinute;
        var s1End = s1.EndHour * 60 + s1.EndMinute;
        var s2Start = s2.StartHour * 60 + s2.StartMinute;
        var s2End = s2.EndHour * 60 + s2.EndMinute;
        return s1Start < s2End && s1End > s2Start;
    }

    private static int CalculateSlotScore(Room room, int hour, int dayOfWeek)
    {
        var score = 100;

        if (hour >= 9 && hour <= 11)
            score += 20;

        if (hour >= 14 && hour <= 16)
            score += 15;

        if (dayOfWeek >= 1 && dayOfWeek <= 3)
            score += 10;

        score += room.Capacity / 5;

        return score;
    }
}

public class ConflictResult
{
    public ConflictType Type { get; set; }
    public int Schedule1Id { get; set; }
    public int Schedule2Id { get; set; }
    public string? Schedule1Title { get; set; }
    public string? Schedule2Title { get; set; }
    public string? Description { get; set; }
    public int? ConflictingCount { get; set; }
}

public enum ConflictType
{
    Room = 1,
    Participant = 2,
    Instructor = 3
}

public class SuggestionSlot
{
    public int RoomId { get; set; }
    public string? RoomName { get; set; }
    public DateTime Date { get; set; }
    public int DayOfWeek { get; set; }
    public int StartHour { get; set; }
    public int EndHour { get; set; }
    public int Score { get; set; }
}

public class BatchScheduleItem
{
    public int CourseId { get; set; }
    public int RoomId { get; set; }
    public DateTime ScheduleDate { get; set; }
    public int StartHour { get; set; }
    public int StartMinute { get; set; }
    public int EndHour { get; set; }
    public int EndMinute { get; set; }
    public int? TrainingPlanId { get; set; }
    public string? Notes { get; set; }
}

public class BatchScheduleResult
{
    public int ScheduledCount { get; set; }
    public List<FailedScheduleItem> FailedItems { get; set; } = new();
    public bool Success => !FailedItems.Any();
}

public class FailedScheduleItem
{
    public int CourseId { get; set; }
    public string? Reason { get; set; }
}
