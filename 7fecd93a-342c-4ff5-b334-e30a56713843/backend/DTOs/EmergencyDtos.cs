namespace WaterManagement.API.DTOs;

using WaterManagement.API.Models;

public class EmergencyPlanDto
{
    public string Id { get; set; } = string.Empty;
    public string ReservoirId { get; set; } = string.Empty;
    public string ReservoirName { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public bool IsCurrent { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? ApprovedAt { get; set; }
    public string? Description { get; set; }
    public List<ResponseLevelConfigDto> Levels { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class ResponseLevelConfigDto
{
    public ResponseLevel Level { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public double TriggerWaterLevel { get; set; }
    public double? TriggerFlow { get; set; }
    public double? TriggerRainfall { get; set; }
    public string Color { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<ResponseMeasureDto> Measures { get; set; } = new();
    public List<string> ResponsibleRoles { get; set; } = new();
}

public class ResponseMeasureDto
{
    public string MeasureId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Order { get; set; }
}

public class PlanVersionInfo
{
    public string Id { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public bool IsCurrent { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class PlanDiffDto
{
    public string ReservoirId { get; set; } = string.Empty;
    public string OldVersion { get; set; } = string.Empty;
    public string NewVersion { get; set; } = string.Empty;
    public List<PlanDiffItem> Differences { get; set; } = new();
}

public class PlanDiffItem
{
    public string Path { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string ChangeType { get; set; } = "modified";
}

public class PlanMatchResult
{
    public string ReservoirId { get; set; } = string.Empty;
    public string ReservoirName { get; set; } = string.Empty;
    public double CurrentWaterLevel { get; set; }
    public ResponseLevel MatchedLevel { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<ResponseMeasureDto> Measures { get; set; } = new();
    public List<string> ResponsibleRoles { get; set; } = new();
}

public class ContactDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ContactRole Role { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Department { get; set; }
    public string? Position { get; set; }
    public bool IsOnDuty { get; set; }
}

public class NotifyRequestDto
{
    public List<string> ContactIds { get; set; } = new();
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationChannel Channel { get; set; } = NotificationChannel.AppPush;
    public string Priority { get; set; } = "normal";
    public string? SenderName { get; set; }
    public string? RelatedType { get; set; }
    public string? RelatedId { get; set; }
}

public class NotificationLogDto
{
    public string Id { get; set; } = string.Empty;
    public string BatchId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public NotificationChannel Channel { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public NotificationStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime? SentAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<NotificationStatusEntry> StatusHistory { get; set; } = new();
}

public class ReportStatsDto
{
    public List<WaterLevelPoint> LevelCurve { get; set; } = new();
    public List<RainfallPoint> RainfallIsohyet { get; set; } = new();
    public DispatchStatsDto DispatchStats { get; set; } = new();
    public InspectionStatsDto InspectionStats { get; set; } = new();
}

public class WaterLevelPoint
{
    public long T { get; set; }
    public double Level { get; set; }
}

public class RainfallPoint
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Value { get; set; }
    public string Name { get; set; } = string.Empty;
}
