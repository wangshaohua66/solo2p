namespace WaterManagement.API.DTOs;

using WaterManagement.API.Models;

public class InspectionTaskDto
{
    public string Id { get; set; } = string.Empty;
    public string TaskCode { get; set; } = string.Empty;
    public string? PlanId { get; set; }
    public string PlanMonth { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string FacilityType { get; set; } = string.Empty;
    public string FacilityName { get; set; } = string.Empty;
    public string InspectorId { get; set; } = string.Empty;
    public string InspectorName { get; set; } = string.Empty;
    public InspectionStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime ScheduledDate { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int DefectCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InspectionTaskDetailDto : InspectionTaskDto
{
    public List<string> Route { get; set; } = new();
    public List<DefectDto> Defects { get; set; } = new();
    public string? Remark { get; set; }
}

public class DefectDto
{
    public string DefectId { get; set; } = string.Empty;
    public string PartName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DefectSeverity Severity { get; set; }
    public string SeverityName { get; set; } = string.Empty;
    public DefectStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? Location { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public List<string> Photos { get; set; } = new();
    public string? ReporterName { get; set; }
    public DateTime ReportTime { get; set; }
    public DateTime? ResolveTime { get; set; }
    public string? ResolveRemark { get; set; }
}

public class DefectReportDto
{
    public string TaskId { get; set; } = string.Empty;
    public string PartName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DefectSeverity Severity { get; set; }
    public string? Location { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public List<string>? Photos { get; set; }
    public string? ReporterName { get; set; }
}

public class DefectResolveDto
{
    public string ResolveRemark { get; set; } = string.Empty;
    public string? OperatorName { get; set; }
}

public class InspectionPlanGenerateDto
{
    public string Month { get; set; } = string.Empty;
    public string? PlanType { get; set; }
}

public class InspectionStatsDto
{
    public int TotalTasks { get; set; }
    public int PendingTasks { get; set; }
    public int InProgressTasks { get; set; }
    public int CompletedTasks { get; set; }
    public int HasDefectTasks { get; set; }
    public int TotalDefects { get; set; }
    public int ResolvedDefects { get; set; }
    public Dictionary<string, int> DefectsBySeverity { get; set; } = new();
    public List<DefectPartStat> DefectsByPart { get; set; } = new();
}

public class DefectPartStat
{
    public string Part { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class InspectionTaskQueryParams : PagedQueryParams
{
    public InspectionStatus? Status { get; set; }
    public string? InspectorId { get; set; }
    public string? FacilityType { get; set; }
    public DefectSeverity? DefectSeverity { get; set; }
    public DefectStatus? DefectStatus { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}
