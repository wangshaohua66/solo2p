namespace FireTraining.Models;

public class ConflictCheckRequest
{
    public int RoomId { get; set; }
    public DateTime ScheduleDate { get; set; }
    public int StartHour { get; set; }
    public int StartMinute { get; set; }
    public int EndHour { get; set; }
    public int EndMinute { get; set; }
    public int? ExcludeScheduleId { get; set; }
}

public class ScoreDeviationRequest
{
    public int ExamId { get; set; }
    public int FirefighterId { get; set; }
    public decimal Score { get; set; }
}

public class AvailabilityCheckRequest
{
    public int EquipmentId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int Qty { get; set; }
    public int Priority { get; set; }
}
