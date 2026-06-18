using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class ShiftSchedule
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string FacilityId { get; set; } = string.Empty;

    public string CareZone { get; set; } = string.Empty;

    public string StaffId { get; set; } = string.Empty;

    public string StaffName { get; set; } = string.Empty;

    public string Position { get; set; } = string.Empty;

    public List<string> Skills { get; set; } = new();

    public string ShiftType { get; set; } = string.Empty;

    public DateTime ShiftDate { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int BreakMinutes { get; set; }

    public string Status { get; set; } = "Scheduled";

    public string? TemplateId { get; set; }

    public List<LeaveRequest> LeaveRequests { get; set; } = new();

    public string? SwapWithScheduleId { get; set; }

    public string? SwapWithStaffId { get; set; }

    public string? SwapWithStaffName { get; set; }

    public bool IsSwapPending { get; set; }

    public DateTime? ClockInTime { get; set; }

    public DateTime? ClockOutTime { get; set; }

    public string? ClockInLocation { get; set; }

    public string? ClockOutLocation { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class LeaveRequest
{
    public string RequestId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string StaffId { get; set; } = string.Empty;

    public string StaffName { get; set; } = string.Empty;

    public string LeaveType { get; set; } = string.Empty;

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public decimal DurationDays { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public string? ApproverId { get; set; }

    public string? ApproverName { get; set; }

    public DateTime? ApprovalDate { get; set; }

    public string? ApprovalNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ShiftTemplate
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;

    public string ShiftType { get; set; } = string.Empty;

    public TimeSpan StartTime { get; set; }

    public TimeSpan EndTime { get; set; }

    public int BreakMinutes { get; set; }

    public string? Color { get; set; }

    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Staff
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;

    public string Gender { get; set; } = string.Empty;

    public string Position { get; set; } = string.Empty;

    public List<string> Skills { get; set; } = new();

    public string FacilityId { get; set; } = string.Empty;

    public string CareZone { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string EmployeeId { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ScheduleConflict
{
    public string ScheduleId { get; set; } = string.Empty;

    public string StaffId { get; set; } = string.Empty;

    public string StaffName { get; set; } = string.Empty;

    public string ConflictType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime ConflictDate { get; set; }

    public string? ConflictScheduleId { get; set; }
}
