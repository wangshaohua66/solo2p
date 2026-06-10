using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class StudioService : IStudioService
{
    private readonly AppDbContext _context;

    public StudioService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Station>> GetStationsAsync(StationType? type = null)
    {
        var query = _context.Stations.AsQueryable();
        if (type.HasValue)
            query = query.Where(s => s.Type == type.Value);

        return await query
            .OrderBy(s => s.Position)
            .ToListAsync();
    }

    public async Task<Station?> GetStationByIdAsync(Guid id)
    {
        return await _context.Stations
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<Station> CreateStationAsync(Station station)
    {
        station.Id = Guid.NewGuid();
        station.CreatedAt = DateTime.UtcNow;
        station.UpdatedAt = DateTime.UtcNow;

        _context.Stations.Add(station);
        await _context.SaveChangesAsync();
        return station;
    }

    public async Task<Station> UpdateStationAsync(Guid id, Station station)
    {
        var existing = await _context.Stations.FindAsync(id)
            ?? throw new InvalidOperationException("工位不存在");

        existing.Name = station.Name;
        existing.Type = station.Type;
        existing.Status = station.Status;
        existing.Position = station.Position;
        existing.Description = station.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteStationAsync(Guid id)
    {
        var station = await _context.Stations.FindAsync(id)
            ?? throw new InvalidOperationException("工位不存在");

        var hasActiveBookings = await _context.StudioBookings
            .AnyAsync(b => b.StationId == id 
                && (b.Status == BookingStatus.Booked || b.Status == BookingStatus.InProgress));

        if (hasActiveBookings)
            throw new InvalidOperationException("该工位有进行中的预约，无法删除");

        _context.Stations.Remove(station);
        await _context.SaveChangesAsync();
    }

    public async Task<List<StudioBooking>> GetBookingsAsync(
        DateTime? date = null,
        Guid? stationId = null,
        Guid? memberId = null)
    {
        var query = _context.StudioBookings
            .Include(b => b.Station)
            .Include(b => b.Member)
            .AsQueryable();

        if (date.HasValue)
        {
            var dateValue = date.Value.Date;
            query = query.Where(b => b.StartTime.Date == dateValue);
        }

        if (stationId.HasValue)
            query = query.Where(b => b.StationId == stationId.Value);

        if (memberId.HasValue)
            query = query.Where(b => b.MemberId == memberId.Value);

        return await query
            .OrderBy(b => b.StartTime)
            .ToListAsync();
    }

    public async Task<StudioBooking?> GetBookingByIdAsync(Guid id)
    {
        return await _context.StudioBookings
            .Include(b => b.Station)
            .Include(b => b.Member)
            .FirstOrDefaultAsync(b => b.Id == id);
    }

    public async Task<StudioBooking> CreateBookingAsync(StudioBooking booking)
    {
        if (booking.StartTime >= booking.EndTime)
            throw new ArgumentException("结束时间必须晚于开始时间");

        if (booking.StartTime < DateTime.UtcNow)
            throw new ArgumentException("预约时间不能早于当前时间");

        var station = await _context.Stations.FindAsync(booking.StationId);
        if (station == null)
            throw new InvalidOperationException("工位不存在");

        if (station.Status != StationStatus.Available)
            throw new InvalidOperationException("该工位不可用");

        var available = await CheckAvailabilityAsync(booking.StationId, booking.StartTime, booking.EndTime);
        if (!available)
            throw new InvalidOperationException("该时段已被预约");

        booking.Id = Guid.NewGuid();
        booking.Status = BookingStatus.Booked;
        booking.CreatedAt = DateTime.UtcNow;
        booking.UpdatedAt = DateTime.UtcNow;

        var duration = (booking.EndTime - booking.StartTime).TotalHours;
        booking.DurationHours = (decimal)duration;
        booking.PointsEarned = (int)(duration * 10);

        _context.StudioBookings.Add(booking);
        await _context.SaveChangesAsync();

        return booking;
    }

    public async Task CancelBookingAsync(Guid bookingId, Guid memberId)
    {
        var booking = await _context.StudioBookings.FindAsync(bookingId)
            ?? throw new InvalidOperationException("预约不存在");

        if (booking.MemberId != memberId)
            throw new UnauthorizedAccessException("无权取消他人的预约");

        if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
            throw new InvalidOperationException("该预约无法取消");

        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;
        booking.PointsEarned = 0;

        await _context.SaveChangesAsync();
    }

    public async Task<StudioBooking> CheckInAsync(Guid bookingId)
    {
        var booking = await _context.StudioBookings.FindAsync(bookingId)
            ?? throw new InvalidOperationException("预约不存在");

        if (booking.Status != BookingStatus.Booked)
            throw new InvalidOperationException("该预约无法签到");

        var now = DateTime.UtcNow;
        var timeDiff = (now - booking.StartTime).TotalMinutes;
        
        if (timeDiff < -15)
            throw new InvalidOperationException("签到时间未到（预约前15分钟开放签到）");

        if (timeDiff > 30)
        {
            booking.Status = BookingStatus.NoShow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            throw new InvalidOperationException("已过签到时间，预约已取消");
        }

        booking.Status = BookingStatus.InProgress;
        booking.ActualStartTime = now;
        booking.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return booking;
    }

    public async Task<StudioBooking> CheckOutAsync(Guid bookingId)
    {
        var booking = await _context.StudioBookings.FindAsync(bookingId)
            ?? throw new InvalidOperationException("预约不存在");

        if (booking.Status != BookingStatus.InProgress)
            throw new InvalidOperationException("该预约未在进行中");

        var now = DateTime.UtcNow;
        booking.ActualEndTime = now;
        booking.Status = BookingStatus.Completed;

        var actualDuration = (now - booking.ActualStartTime).Value.TotalHours;
        booking.ActualHours = (decimal)actualDuration;
        booking.PointsEarned = Math.Max(0, (int)(actualDuration * 10));

        booking.UpdatedAt = DateTime.UtcNow;

        var member = await _context.Users.FindAsync(booking.MemberId);
        if (member != null)
        {
            member.Points += booking.PointsEarned;
            member.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return booking;
    }

    public async Task<int> GetOccupancyAsync(DateTime date)
    {
        var dateValue = date.Date;
        var bookings = await _context.StudioBookings
            .Where(b => b.StartTime.Date == dateValue 
                && (b.Status == BookingStatus.Booked 
                    || b.Status == BookingStatus.InProgress))
            .ToListAsync();

        return bookings.Count;
    }

    public async Task<bool> CheckAvailabilityAsync(
        Guid stationId, 
        DateTime startTime, 
        DateTime endTime,
        Guid? excludeId = null)
    {
        var query = _context.StudioBookings
            .Where(b => b.StationId == stationId
                && b.Status != BookingStatus.Cancelled
                && b.Status != BookingStatus.NoShow
                && b.StartTime < endTime
                && b.EndTime > startTime);

        if (excludeId.HasValue)
            query = query.Where(b => b.Id != excludeId.Value);

        return !await query.AnyAsync();
    }
}
