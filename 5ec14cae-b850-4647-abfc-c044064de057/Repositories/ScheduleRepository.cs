using ElderlyCareSystem.Data;
using ElderlyCareSystem.Models;
using MongoDB.Driver;
using MongoDB.Bson;

namespace ElderlyCareSystem.Repositories;

public interface IScheduleRepository
{
    Task<List<ShiftSchedule>> GetAllAsync(string? facilityId = null);
    Task<ShiftSchedule?> GetByIdAsync(string id);
    Task<ShiftSchedule> CreateAsync(ShiftSchedule schedule);
    Task UpdateAsync(string id, ShiftSchedule schedule);
    Task DeleteAsync(string id);
    Task<List<ShiftSchedule>> GetByDateRangeAsync(DateTime startDate, DateTime endDate, string? facilityId = null);
    Task<List<ShiftSchedule>> GetByStaffAsync(string staffId, DateTime? startDate = null, DateTime? endDate = null);
    Task<List<ShiftSchedule>> GetByCareZoneAsync(string careZone, DateTime date, string? facilityId = null);
    Task<List<Staff>> GetAllStaffAsync(string? facilityId = null);
    Task<Staff> CreateStaffAsync(Staff staff);
    Task<List<ShiftTemplate>> GetAllTemplatesAsync();
    Task<ShiftTemplate> CreateTemplateAsync(ShiftTemplate template);
    Task<List<LeaveRequest>> GetAllLeaveRequestsAsync(string? facilityId = null);
    Task<LeaveRequest?> GetLeaveRequestByIdAsync(string requestId);
    Task UpdateLeaveRequestAsync(string requestId, LeaveRequest request);
    Task<List<ScheduleConflict>> CheckConflictsAsync(string staffId, DateTime shiftDate, DateTime startTime, DateTime endTime, string? excludeScheduleId = null);
}

public class ScheduleRepository : IScheduleRepository
{
    private readonly MongoDbContext _context;

    public ScheduleRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<List<ShiftSchedule>> GetAllAsync(string? facilityId = null)
    {
        var filter = Builders<ShiftSchedule>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            filter = Builders<ShiftSchedule>.Filter.Eq(x => x.FacilityId, facilityId);
        }
        return await _context.ShiftSchedules.Find(filter).SortByDescending(x => x.ShiftDate).ToListAsync();
    }

    public async Task<ShiftSchedule?> GetByIdAsync(string id)
    {
        var filter = Builders<ShiftSchedule>.Filter.Eq(x => x.Id, id);
        return await _context.ShiftSchedules.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<ShiftSchedule> CreateAsync(ShiftSchedule schedule)
    {
        schedule.Id = ObjectId.GenerateNewId().ToString();
        schedule.CreatedAt = DateTime.UtcNow;
        schedule.UpdatedAt = DateTime.UtcNow;
        await _context.ShiftSchedules.InsertOneAsync(schedule);
        return schedule;
    }

    public async Task UpdateAsync(string id, ShiftSchedule schedule)
    {
        schedule.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<ShiftSchedule>.Filter.Eq(x => x.Id, id);
        await _context.ShiftSchedules.ReplaceOneAsync(filter, schedule);
    }

    public async Task DeleteAsync(string id)
    {
        var filter = Builders<ShiftSchedule>.Filter.Eq(x => x.Id, id);
        await _context.ShiftSchedules.DeleteOneAsync(filter);
    }

    public async Task<List<ShiftSchedule>> GetByDateRangeAsync(DateTime startDate, DateTime endDate, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<ShiftSchedule>>
        {
            Builders<ShiftSchedule>.Filter.Gte(x => x.ShiftDate, startDate.Date),
            Builders<ShiftSchedule>.Filter.Lte(x => x.ShiftDate, endDate.Date)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<ShiftSchedule>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<ShiftSchedule>.Filter.And(filters);
        return await _context.ShiftSchedules.Find(filter).SortBy(x => x.ShiftDate).ThenBy(x => x.StartTime).ToListAsync();
    }

    public async Task<List<ShiftSchedule>> GetByStaffAsync(string staffId, DateTime? startDate = null, DateTime? endDate = null)
    {
        var filters = new List<FilterDefinition<ShiftSchedule>>
        {
            Builders<ShiftSchedule>.Filter.Eq(x => x.StaffId, staffId)
        };
        if (startDate.HasValue)
        {
            filters.Add(Builders<ShiftSchedule>.Filter.Gte(x => x.ShiftDate, startDate.Value.Date));
        }
        if (endDate.HasValue)
        {
            filters.Add(Builders<ShiftSchedule>.Filter.Lte(x => x.ShiftDate, endDate.Value.Date));
        }
        var filter = Builders<ShiftSchedule>.Filter.And(filters);
        return await _context.ShiftSchedules.Find(filter).SortBy(x => x.ShiftDate).ToListAsync();
    }

    public async Task<List<ShiftSchedule>> GetByCareZoneAsync(string careZone, DateTime date, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<ShiftSchedule>>
        {
            Builders<ShiftSchedule>.Filter.Eq(x => x.CareZone, careZone),
            Builders<ShiftSchedule>.Filter.Eq(x => x.ShiftDate, date.Date)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<ShiftSchedule>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<ShiftSchedule>.Filter.And(filters);
        return await _context.ShiftSchedules.Find(filter).ToListAsync();
    }

    public async Task<List<Staff>> GetAllStaffAsync(string? facilityId = null)
    {
        var filter = Builders<Staff>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            filter = Builders<Staff>.Filter.Eq(x => x.FacilityId, facilityId);
        }
        return await _context.Staffs.Find(filter).ToListAsync();
    }

    public async Task<Staff> CreateStaffAsync(Staff staff)
    {
        staff.Id = ObjectId.GenerateNewId().ToString();
        staff.CreatedAt = DateTime.UtcNow;
        await _context.Staffs.InsertOneAsync(staff);
        return staff;
    }

    public async Task<List<ShiftTemplate>> GetAllTemplatesAsync()
    {
        var filter = Builders<ShiftTemplate>.Filter.Eq(x => x.IsActive, true);
        return await _context.ShiftTemplates.Find(filter).ToListAsync();
    }

    public async Task<ShiftTemplate> CreateTemplateAsync(ShiftTemplate template)
    {
        template.Id = ObjectId.GenerateNewId().ToString();
        template.CreatedAt = DateTime.UtcNow;
        await _context.ShiftTemplates.InsertOneAsync(template);
        return template;
    }

    public async Task<List<LeaveRequest>> GetAllLeaveRequestsAsync(string? facilityId = null)
    {
        var schedules = await _context.ShiftSchedules.Find(Builders<ShiftSchedule>.Filter.Empty).ToListAsync();
        var allRequests = new List<LeaveRequest>();
        foreach (var s in schedules)
        {
            if (s.LeaveRequests != null && s.LeaveRequests.Count > 0)
            {
                allRequests.AddRange(s.LeaveRequests);
            }
        }
        return allRequests.OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task<LeaveRequest?> GetLeaveRequestByIdAsync(string requestId)
    {
        var schedules = await _context.ShiftSchedules.Find(Builders<ShiftSchedule>.Filter.Empty).ToListAsync();
        foreach (var s in schedules)
        {
            var request = s.LeaveRequests.FirstOrDefault(l => l.RequestId == requestId);
            if (request != null) return request;
        }
        return null;
    }

    public async Task UpdateLeaveRequestAsync(string requestId, LeaveRequest request)
    {
        var filter = Builders<ShiftSchedule>.Filter.ElemMatch(x => x.LeaveRequests, l => l.RequestId == requestId);
        var update = Builders<ShiftSchedule>.Update.Set(x => x.LeaveRequests[-1], request);
        await _context.ShiftSchedules.UpdateOneAsync(filter, update);
    }

    public async Task<List<ScheduleConflict>> CheckConflictsAsync(string staffId, DateTime shiftDate, DateTime startTime, DateTime endTime, string? excludeScheduleId = null)
    {
        var filters = new List<FilterDefinition<ShiftSchedule>>
        {
            Builders<ShiftSchedule>.Filter.Eq(x => x.StaffId, staffId),
            Builders<ShiftSchedule>.Filter.Eq(x => x.ShiftDate, shiftDate.Date),
            Builders<ShiftSchedule>.Filter.Or(
                Builders<ShiftSchedule>.Filter.And(
                    Builders<ShiftSchedule>.Filter.Lte(x => x.StartTime, endTime),
                    Builders<ShiftSchedule>.Filter.Gte(x => x.EndTime, startTime)
                )
            )
        };

        if (!string.IsNullOrEmpty(excludeScheduleId))
        {
            filters.Add(Builders<ShiftSchedule>.Filter.Ne(x => x.Id, excludeScheduleId));
        }

        var filter = Builders<ShiftSchedule>.Filter.And(filters);
        var conflicts = await _context.ShiftSchedules.Find(filter).ToListAsync();

        return conflicts.Select(c => new ScheduleConflict
        {
            ScheduleId = c.Id,
            StaffId = c.StaffId,
            StaffName = c.StaffName,
            ConflictType = "TimeOverlap",
            Description = $"与 {c.ShiftType} 班次时间冲突 ({c.StartTime:HH:mm}-{c.EndTime:HH:mm})",
            ConflictDate = c.ShiftDate,
            ConflictScheduleId = c.Id
        }).ToList();
    }
}
