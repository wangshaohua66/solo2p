using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class KilnService : IKilnService
{
    private readonly AppDbContext _context;

    public KilnService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Kiln>> GetKilnsAsync()
    {
        return await _context.Kilns
            .OrderBy(k => k.Name)
            .ToListAsync();
    }

    public async Task<Kiln?> GetKilnByIdAsync(Guid id)
    {
        return await _context.Kilns
            .Include(k => k.Schedules)
            .FirstOrDefaultAsync(k => k.Id == id);
    }

    public async Task<Kiln> CreateKilnAsync(Kiln kiln)
    {
        kiln.Id = Guid.NewGuid();
        kiln.CreatedAt = DateTime.UtcNow;
        kiln.UpdatedAt = DateTime.UtcNow;
        
        _context.Kilns.Add(kiln);
        await _context.SaveChangesAsync();
        return kiln;
    }

    public async Task<Kiln> UpdateKilnAsync(Guid id, Kiln kiln)
    {
        var existing = await _context.Kilns.FindAsync(id)
            ?? throw new InvalidOperationException("窑炉不存在");

        existing.Name = kiln.Name;
        existing.Type = kiln.Type;
        existing.Capacity = kiln.Capacity;
        existing.Status = kiln.Status;
        existing.MaxTemperature = kiln.MaxTemperature;
        existing.Description = kiln.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteKilnAsync(Guid id)
    {
        var kiln = await _context.Kilns.FindAsync(id)
            ?? throw new InvalidOperationException("窑炉不存在");

        var hasActiveSchedules = await _context.KilnSchedules
            .AnyAsync(s => s.KilnId == id && 
                (s.Status == ScheduleStatus.Pending || s.Status == ScheduleStatus.Running));

        if (hasActiveSchedules)
            throw new InvalidOperationException("该窑炉存在进行中的排程，无法删除");

        _context.Kilns.Remove(kiln);
        await _context.SaveChangesAsync();
    }

    public async Task<List<KilnSchedule>> GetSchedulesAsync(
        Guid? kilnId = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null,
        FiringType? firingType = null,
        ScheduleStatus? status = null)
    {
        var query = _context.KilnSchedules
            .Include(s => s.Kiln)
            .AsQueryable();

        if (kilnId.HasValue)
            query = query.Where(s => s.KilnId == kilnId.Value);

        if (startDate.HasValue)
            query = query.Where(s => s.EndTime >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(s => s.StartTime <= endDate.Value);

        if (firingType.HasValue)
            query = query.Where(s => s.FiringType == firingType.Value);

        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        return await query
            .OrderBy(s => s.StartTime)
            .ToListAsync();
    }

    public async Task<KilnSchedule?> GetScheduleByIdAsync(Guid id)
    {
        return await _context.KilnSchedules
            .Include(s => s.Kiln)
            .Include(s => s.Pieces)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<KilnSchedule> CreateScheduleAsync(KilnSchedule schedule, bool forceOverride = false)
    {
        if (schedule.StartTime >= schedule.EndTime)
            throw new ArgumentException("结束时间必须晚于开始时间");

        var kiln = await _context.Kilns.FindAsync(schedule.KilnId);
        if (kiln == null)
            throw new InvalidOperationException("窑炉不存在");

        var conflict = await CheckConflictAsync(schedule.KilnId, schedule.StartTime, schedule.EndTime);
        if (conflict.HasConflict && !forceOverride)
        {
            throw new InvalidOperationException("存在时间冲突");
        }

        schedule.Id = Guid.NewGuid();
        schedule.Status = ScheduleStatus.Pending;
        schedule.CreatedAt = DateTime.UtcNow;
        schedule.UpdatedAt = DateTime.UtcNow;
        schedule.IsForced = forceOverride;
        schedule.KilnName = kiln.Name;

        _context.KilnSchedules.Add(schedule);
        await _context.SaveChangesAsync();

        if (conflict.HasConflict && forceOverride)
        {
            foreach (var conflicting in conflict.ConflictingSchedules)
            {
                _context.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = conflicting.CreatedById,
                    Title = "窑炉排程被覆盖",
                    Content = $"您的排程 \"{conflicting.Title}\" 已被管理员强制覆盖。",
                    Type = NotificationType.Kiln,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();
        }

        return schedule;
    }

    public async Task<KilnSchedule> UpdateScheduleAsync(Guid id, KilnSchedule schedule, bool forceOverride = false)
    {
        var existing = await _context.KilnSchedules.FindAsync(id)
            ?? throw new InvalidOperationException("排程不存在");

        if (existing.Status == ScheduleStatus.Running)
            throw new InvalidOperationException("进行中的排程无法修改");

        var conflict = await CheckConflictAsync(schedule.KilnId, schedule.StartTime, schedule.EndTime, id);
        if (conflict.HasConflict && !forceOverride)
        {
            throw new InvalidOperationException("存在时间冲突");
        }

        existing.KilnId = schedule.KilnId;
        existing.Title = schedule.Title;
        existing.FiringType = schedule.FiringType;
        existing.StartTime = schedule.StartTime;
        existing.EndTime = schedule.EndTime;
        existing.TemperatureCurve = schedule.TemperatureCurve;
        existing.Notes = schedule.Notes;
        existing.IsForced = forceOverride;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteScheduleAsync(Guid id)
    {
        var schedule = await _context.KilnSchedules.FindAsync(id)
            ?? throw new InvalidOperationException("排程不存在");

        if (schedule.Status == ScheduleStatus.Running)
            throw new InvalidOperationException("进行中的排程无法删除");

        _context.KilnSchedules.Remove(schedule);
        await _context.SaveChangesAsync();
    }

    public async Task<ConflictResult> CheckConflictAsync(Guid kilnId, DateTime startTime, DateTime endTime, Guid? excludeId = null)
    {
        var query = _context.KilnSchedules
            .Where(s => s.KilnId == kilnId 
                && s.Status != ScheduleStatus.Cancelled
                && s.StartTime < endTime 
                && s.EndTime > startTime);

        if (excludeId.HasValue)
            query = query.Where(s => s.Id != excludeId.Value);

        var conflicts = await query.ToListAsync();

        return new ConflictResult
        {
            HasConflict = conflicts.Count > 0,
            ConflictingSchedules = conflicts
        };
    }

    public async Task<KilnSchedule> StartFiringAsync(Guid scheduleId)
    {
        var schedule = await _context.KilnSchedules.FindAsync(scheduleId)
            ?? throw new InvalidOperationException("排程不存在");

        if (schedule.Status != ScheduleStatus.Pending)
            throw new InvalidOperationException("只有待执行的排程才能开始烧制");

        schedule.Status = ScheduleStatus.Running;
        schedule.UpdatedAt = DateTime.UtcNow;

        var kiln = await _context.Kilns.FindAsync(schedule.KilnId);
        if (kiln != null)
        {
            kiln.Status = KilnStatus.Running;
            kiln.UpdatedAt = DateTime.UtcNow;
        }

        var firingRecord = new FiringRecord
        {
            Id = Guid.NewGuid(),
            KilnScheduleId = scheduleId,
            StartTime = DateTime.UtcNow,
            StartTemperature = 20,
            CreatedAt = DateTime.UtcNow
        };

        _context.FiringRecords.Add(firingRecord);
        await _context.SaveChangesAsync();

        return schedule;
    }

    public async Task<KilnSchedule> CompleteFiringAsync(Guid scheduleId)
    {
        var schedule = await _context.KilnSchedules.FindAsync(scheduleId)
            ?? throw new InvalidOperationException("排程不存在");

        if (schedule.Status != ScheduleStatus.Running)
            throw new InvalidOperationException("只有进行中的排程才能完成");

        schedule.Status = ScheduleStatus.Completed;
        schedule.UpdatedAt = DateTime.UtcNow;

        var kiln = await _context.Kilns.FindAsync(schedule.KilnId);
        if (kiln != null)
        {
            kiln.Status = KilnStatus.Available;
            kiln.UpdatedAt = DateTime.UtcNow;
        }

        var firingRecord = await _context.FiringRecords
            .OrderByDescending(fr => fr.CreatedAt)
            .FirstOrDefaultAsync(fr => fr.KilnScheduleId == scheduleId);

        if (firingRecord != null)
        {
            firingRecord.EndTime = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return schedule;
    }

    public async Task<KilnSchedule> CancelScheduleAsync(Guid scheduleId)
    {
        var schedule = await _context.KilnSchedules.FindAsync(scheduleId)
            ?? throw new InvalidOperationException("排程不存在");

        if (schedule.Status == ScheduleStatus.Completed || schedule.Status == ScheduleStatus.Cancelled)
            throw new InvalidOperationException("该排程无法取消");

        schedule.Status = ScheduleStatus.Cancelled;
        schedule.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return schedule;
    }

    public async Task<PagedResult<FiringRecord>> GetFiringRecordsAsync(Guid? kilnId = null, PagedQuery? query = null)
    {
        query ??= new PagedQuery();

        var queryable = _context.FiringRecords
            .Include(fr => fr.KilnSchedule)
            .AsQueryable();

        if (kilnId.HasValue)
        {
            queryable = queryable.Where(fr => fr.KilnSchedule != null && fr.KilnSchedule.KilnId == kilnId.Value);
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(fr => fr.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }
}
