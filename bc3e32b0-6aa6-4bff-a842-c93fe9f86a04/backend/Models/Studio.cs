using System.ComponentModel.DataAnnotations;

namespace PotteryStudio.Models;

public enum StationType
{
    Wheel,
    Table,
    Glaze
}

public enum StationStatus
{
    Available,
    Occupied,
    Maintenance
}

public enum BookingStatus
{
    Booked,
    InProgress,
    Completed,
    Cancelled,
    NoShow
}

public class Station
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public StationType Type { get; set; }
    public StationStatus Status { get; set; } = StationStatus.Available;
    public int Position { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<StudioBooking> Bookings { get; set; } = new List<StudioBooking>();
}

public class StudioBooking
{
    public Guid Id { get; set; }
    public Guid MemberId { get; set; }
    public User? Member { get; set; }
    public string? MemberName { get; set; }
    public Guid StationId { get; set; }
    public Station? Station { get; set; }
    public string? StationName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Booked;
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public DateTime? SensorEntryTimestamp { get; set; }
    public DateTime? SensorExitTimestamp { get; set; }
    public decimal DurationHours { get; set; }
    public decimal? ActualHours { get; set; }
    public int? PointsEarned { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }

    [Timestamp]
    public byte[]? RowVersion { get; set; }
}
