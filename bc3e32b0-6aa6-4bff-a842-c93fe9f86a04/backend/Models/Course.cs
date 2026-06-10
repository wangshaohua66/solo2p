namespace PotteryStudio.Models;

public enum CourseType
{
    Wheel,
    Handbuilding,
    Decoration,
    Glaze
}

public enum CourseLevel
{
    Beginner,
    Intermediate,
    Advanced
}

public enum CourseStatus
{
    Draft,
    Published,
    InProgress,
    Completed,
    Cancelled
}

public enum RegistrationStatus
{
    Registered,
    Waitlisted,
    Cancelled,
    Completed
}

public enum AttendanceStatus
{
    Pending,
    Present,
    Absent,
    Late
}

public class CourseSession
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }
    public DateTime Date { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public string? Topic { get; set; }
    public string? QrCode { get; set; }
    public DateTime? QrCodeExpiry { get; set; }

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
}

public class AttendanceRecord
{
    public Guid Id { get; set; }
    public Guid CourseSessionId { get; set; }
    public CourseSession? CourseSession { get; set; }
    public Guid MemberId { get; set; }
    public User? Member { get; set; }
    public DateTime? CheckInTime { get; set; }
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Pending;
    public string? QrCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CourseRegistration
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }
    public Guid MemberId { get; set; }
    public User? Member { get; set; }
    public string? MemberName { get; set; }
    public RegistrationStatus Status { get; set; } = RegistrationStatus.Registered;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public decimal PaidAmount { get; set; }
    public bool IsWaitlist { get; set; }
    public int? WaitlistPosition { get; set; }

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
}

public class Course
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public CourseType Type { get; set; }
    public Guid InstructorId { get; set; }
    public string? InstructorName { get; set; }
    public string? CoverImage { get; set; }
    public decimal Price { get; set; }
    public int Duration { get; set; }
    public int MaxStudents { get; set; }
    public int CurrentStudents { get; set; }
    public CourseLevel Level { get; set; } = CourseLevel.Beginner;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public CourseStatus Status { get; set; } = CourseStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CourseSession> Schedule { get; set; } = new List<CourseSession>();
    public ICollection<CourseRegistration> Registrations { get; set; } = new List<CourseRegistration>();
}
