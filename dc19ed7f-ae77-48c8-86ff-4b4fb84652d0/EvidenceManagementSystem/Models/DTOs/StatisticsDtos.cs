namespace EvidenceManagementSystem.Models.DTOs;

public class StatisticsDto
{
    public int TotalReceived { get; set; }
    public int TotalInStorage { get; set; }
    public int TotalInExamination { get; set; }
    public int TotalExaminationCompleted { get; set; }
    public int TotalOverdue { get; set; }
    public int TotalDestroyed { get; set; }
    public double ExaminationCompletionRate { get; set; }
    public double OverdueRate { get; set; }
    public double InventoryTurnoverRate { get; set; }
}

public class CategoryStatisticsDto
{
    public string Category { get; set; } = string.Empty;
    public int Count { get; set; }
    public double Percentage { get; set; }
}

public class DepartmentStatisticsDto
{
    public string Department { get; set; } = string.Empty;
    public int ReceivedCount { get; set; }
    public int CompletedCount { get; set; }
    public int OverdueCount { get; set; }
    public double CompletionRate { get; set; }
}

public class DailyStatisticsDto
{
    public DateTime Date { get; set; }
    public int ReceivedCount { get; set; }
    public int CompletedCount { get; set; }
    public int OutboundCount { get; set; }
    public int InboundCount { get; set; }
}

public class StatisticsQuery
{
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Department { get; set; }
    public int? Category { get; set; }
}
