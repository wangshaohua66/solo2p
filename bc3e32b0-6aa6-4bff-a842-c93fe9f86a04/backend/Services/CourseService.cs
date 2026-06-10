using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;
using QRCoder;
using System.Drawing;
using System.Drawing.Imaging;

namespace PotteryStudio.Services;

public class CourseService : ICourseService
{
    private readonly AppDbContext _context;

    public CourseService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<Course>> GetCoursesAsync(
        PagedQuery query,
        CourseType? type = null,
        CourseLevel? level = null,
        CourseStatus? status = null)
    {
        var queryable = _context.Courses.AsQueryable();

        if (type.HasValue)
            queryable = queryable.Where(c => c.Type == type.Value);

        if (level.HasValue)
            queryable = queryable.Where(c => c.Level == level.Value);

        if (status.HasValue)
            queryable = queryable.Where(c => c.Status == status.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(c => 
                c.Title.ToLower().Contains(keyword) ||
                c.Description.ToLower().Contains(keyword) ||
                c.InstructorName.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(c => c.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<Course?> GetCourseByIdAsync(Guid id)
    {
        return await _context.Courses
            .Include(c => c.Schedule)
            .Include(c => c.Registrations)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<Course> CreateCourseAsync(Course course)
    {
        course.Id = Guid.NewGuid();
        course.CreatedAt = DateTime.UtcNow;
        course.UpdatedAt = DateTime.UtcNow;

        if (course.Schedule != null)
        {
            foreach (var session in course.Schedule)
            {
                session.Id = Guid.NewGuid();
                session.CourseId = course.Id;
            }
        }

        _context.Courses.Add(course);
        await _context.SaveChangesAsync();
        return course;
    }

    public async Task<Course> UpdateCourseAsync(Guid id, Course course)
    {
        var existing = await _context.Courses
            .Include(c => c.Schedule)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new InvalidOperationException("课程不存在");

        existing.Title = course.Title;
        existing.Description = course.Description;
        existing.Type = course.Type;
        existing.Level = course.Level;
        existing.Price = course.Price;
        existing.Duration = course.Duration;
        existing.MaxStudents = course.MaxStudents;
        existing.Status = course.Status;
        existing.StartDate = course.StartDate;
        existing.EndDate = course.EndDate;
        existing.UpdatedAt = DateTime.UtcNow;

        if (course.Schedule != null)
        {
            existing.Schedule.Clear();
            foreach (var session in course.Schedule)
            {
                session.Id = Guid.NewGuid();
                session.CourseId = existing.Id;
                existing.Schedule.Add(session);
            }
        }

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteCourseAsync(Guid id)
    {
        var course = await _context.Courses.FindAsync(id)
            ?? throw new InvalidOperationException("课程不存在");

        var hasRegistrations = await _context.CourseRegistrations
            .AnyAsync(r => r.CourseId == id && r.Status != RegistrationStatus.Cancelled);

        if (hasRegistrations)
            throw new InvalidOperationException("该课程有学员报名，无法删除");

        _context.Courses.Remove(course);
        await _context.SaveChangesAsync();
    }

    public async Task<CourseRegistration> RegisterCourseAsync(Guid courseId, Guid memberId, string memberName)
    {
        var course = await _context.Courses.FindAsync(courseId)
            ?? throw new InvalidOperationException("课程不存在");

        if (course.Status != CourseStatus.Published)
            throw new InvalidOperationException("该课程不可报名");

        var existingRegistration = await _context.CourseRegistrations
            .FirstOrDefaultAsync(r => r.CourseId == courseId && r.MemberId == memberId 
                && r.Status != RegistrationStatus.Cancelled);

        if (existingRegistration != null)
            throw new InvalidOperationException("您已报名该课程");

        var isFull = course.CurrentStudents >= course.MaxStudents;

        var registration = new CourseRegistration
        {
            Id = Guid.NewGuid(),
            CourseId = courseId,
            MemberId = memberId,
            MemberName = memberName,
            Status = isFull ? RegistrationStatus.Waitlist : RegistrationStatus.Confirmed,
            Price = course.Price,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (!isFull)
        {
            course.CurrentStudents++;
        }

        _context.CourseRegistrations.Add(registration);
        await _context.SaveChangesAsync();

        return registration;
    }

    public async Task CancelRegistrationAsync(Guid registrationId, Guid memberId)
    {
        var registration = await _context.CourseRegistrations.FindAsync(registrationId)
            ?? throw new InvalidOperationException("报名记录不存在");

        if (registration.MemberId != memberId)
            throw new UnauthorizedAccessException("无权取消他人的报名");

        if (registration.Status == RegistrationStatus.Cancelled)
            throw new InvalidOperationException("该报名已取消");

        registration.Status = RegistrationStatus.Cancelled;
        registration.UpdatedAt = DateTime.UtcNow;

        if (registration.Status == RegistrationStatus.Confirmed)
        {
            var course = await _context.Courses.FindAsync(registration.CourseId);
            if (course != null && course.CurrentStudents > 0)
            {
                course.CurrentStudents--;
                
                var waitlistNext = await _context.CourseRegistrations
                    .Where(r => r.CourseId == registration.CourseId 
                        && r.Status == RegistrationStatus.Waitlist)
                    .OrderBy(r => r.CreatedAt)
                    .FirstOrDefaultAsync();

                if (waitlistNext != null)
                {
                    waitlistNext.Status = RegistrationStatus.Confirmed;
                    waitlistNext.UpdatedAt = DateTime.UtcNow;
                    course.CurrentStudents++;
                }
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task<List<CourseRegistration>> GetCourseRegistrationsAsync(Guid courseId)
    {
        return await _context.CourseRegistrations
            .Where(r => r.CourseId == courseId)
            .OrderBy(r => r.Status)
            .ThenBy(r => r.CreatedAt)
            .ToListAsync();
    }

    public async Task<AttendanceRecord> CheckInAsync(Guid sessionId, Guid memberId)
    {
        var session = await _context.CourseSessions.FindAsync(sessionId)
            ?? throw new InvalidOperationException("课程场次不存在");

        var registration = await _context.CourseRegistrations
            .FirstOrDefaultAsync(r => r.CourseId == session.CourseId 
                && r.MemberId == memberId 
                && r.Status == RegistrationStatus.Confirmed);

        if (registration == null)
            throw new InvalidOperationException("您未报名该课程");

        var existingAttendance = await _context.AttendanceRecords
            .FirstOrDefaultAsync(a => a.CourseSessionId == sessionId && a.MemberId == memberId);

        if (existingAttendance != null)
            throw new InvalidOperationException("您已签到");

        var sessionStart = session.Date.Date.Add(session.StartTime);
        var now = DateTime.UtcNow;
        var timeDiff = (now - sessionStart).TotalMinutes;

        var status = timeDiff switch
        {
            < -30 => throw new InvalidOperationException("签到尚未开放（开课前30分钟开放）"),
            <= 15 => AttendanceStatus.Present,
            <= 90 => AttendanceStatus.Late,
            _ => throw new InvalidOperationException("已过签到时间")
        };

        var attendance = new AttendanceRecord
        {
            Id = Guid.NewGuid(),
            CourseSessionId = sessionId,
            MemberId = memberId,
            CheckInTime = now,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };

        _context.AttendanceRecords.Add(attendance);

        if (timeDiff > 15)
        {
            registration.Status = RegistrationStatus.Waitlist;
            var waitlistNext = await _context.CourseRegistrations
                .Where(r => r.CourseId == session.CourseId 
                    && r.Status == RegistrationStatus.Waitlist
                    && r.Id != registration.Id)
                .OrderBy(r => r.CreatedAt)
                .FirstOrDefaultAsync();

            if (waitlistNext != null)
            {
                waitlistNext.Status = RegistrationStatus.Confirmed;
                waitlistNext.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return attendance;
    }

    public async Task<string> GenerateQrCodeAsync(Guid sessionId)
    {
        var session = await _context.CourseSessions.FindAsync(sessionId)
            ?? throw new InvalidOperationException("课程场次不存在");

        var qrData = $"pottery:checkin:{sessionId}:{Guid.NewGuid()}";
        
        using var qrGenerator = new QRCodeGenerator();
        var qrCodeData = qrGenerator.CreateQrCode(qrData, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new QRCode(qrCodeData);
        using var qrImage = qrCode.GetGraphic(20);
        
        using var ms = new MemoryStream();
        qrImage.Save(ms, ImageFormat.Png);
        var base64 = Convert.ToBase64String(ms.ToArray());
        
        return $"data:image/png;base64,{base64}";
    }

    public async Task<List<AttendanceRecord>> GetSessionAttendanceAsync(Guid sessionId)
    {
        return await _context.AttendanceRecords
            .Where(a => a.CourseSessionId == sessionId)
            .OrderBy(a => a.CheckInTime)
            .ToListAsync();
    }

    public async Task<List<CourseSession>> GetCourseSessionsAsync(Guid courseId)
    {
        return await _context.CourseSessions
            .Where(s => s.CourseId == courseId)
            .OrderBy(s => s.Date)
            .ThenBy(s => s.StartTime)
            .ToListAsync();
    }
}
