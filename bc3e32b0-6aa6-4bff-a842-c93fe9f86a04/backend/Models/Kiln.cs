namespace PotteryStudio.Models;

public enum KilnType
{
    Electric,
    Gas,
    Wood
}

public enum KilnStatus
{
    Available,
    Running,
    Maintenance
}

public class Kiln
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public KilnType Type { get; set; }
    public decimal Capacity { get; set; }
    public KilnStatus Status { get; set; } = KilnStatus.Available;
    public decimal MaxTemperature { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<KilnSchedule> Schedules { get; set; } = new List<KilnSchedule>();
}

public enum FiringType
{
    Bisque,
    Glaze,
    Reduction
}

public enum ScheduleStatus
{
    Pending,
    Running,
    Completed,
    Cancelled
}

public class TemperaturePoint
{
    public int Time { get; set; }
    public decimal Temperature { get; set; }
}

public class KilnSchedule
{
    public Guid Id { get; set; }
    public Guid KilnId { get; set; }
    public Kiln? Kiln { get; set; }
    public string Title { get; set; } = string.Empty;
    public FiringType FiringType { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public List<TemperaturePoint>? TemperatureCurve { get; set; }
    public Guid CreatedById { get; set; }
    public string? CreatedByName { get; set; }
    public ScheduleStatus Status { get; set; } = ScheduleStatus.Pending;
    public string? Notes { get; set; }
    public bool IsForced { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PieceArchive> Pieces { get; set; } = new List<PieceArchive>();
    public ICollection<FiringRecord> FiringRecords { get; set; } = new List<FiringRecord>();
}

public class FiringRecord
{
    public Guid Id { get; set; }
    public Guid KilnScheduleId { get; set; }
    public KilnSchedule? KilnSchedule { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal StartTemperature { get; set; }
    public decimal PeakTemperature { get; set; }
    public string? Operator { get; set; }
    public string? Notes { get; set; }
    public List<TemperaturePoint>? TemperatureLog { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ConflictResult
{
    public bool HasConflict { get; set; }
    public List<KilnSchedule> ConflictingSchedules { get; set; } = new();
}
