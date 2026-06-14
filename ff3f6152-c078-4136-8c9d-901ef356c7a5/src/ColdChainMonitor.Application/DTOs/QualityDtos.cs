using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.DTOs;

public class QualityReportDto
{
    public string Id { get; set; } = string.Empty;
    public string ReportNo { get; set; } = string.Empty;
    public string TransportTaskId { get; set; } = string.Empty;
    public string TaskNo { get; set; } = string.Empty;
    public DrugBatchDto DrugBatch { get; set; } = new();
    public string InspectorId { get; set; } = string.Empty;
    public string InspectorName { get; set; } = string.Empty;
    public QualityResult Result { get; set; }
    public string ResultText { get; set; } = string.Empty;
    public TemperatureSummaryDto TemperatureSummary { get; set; } = new();
    public AlertSummaryDto AlertSummary { get; set; } = new();
    public string Conclusion { get; set; } = string.Empty;
    public string? RejectReason { get; set; }
    public string? Suggestions { get; set; }
    public DateTime? InspectedAt { get; set; }
    public DateTime? SignedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TemperatureSummaryDto
{
    public double AvgTemperature { get; set; }
    public double MaxTemperature { get; set; }
    public double MinTemperature { get; set; }
    public double? AvgHumidity { get; set; }
    public double? MaxHumidity { get; set; }
    public double? MinHumidity { get; set; }
    public long TotalRecords { get; set; }
    public long AnomalyRecords { get; set; }
    public double TransportDurationMinutes { get; set; }
    public double OutOfRangeDurationMinutes { get; set; }
    public double ComplianceRate { get; set; }
}

public class AlertSummaryDto
{
    public int TotalAlerts { get; set; }
    public int CriticalAlerts { get; set; }
    public int WarningAlerts { get; set; }
    public int AcknowledgedAlerts { get; set; }
    public int ResolvedAlerts { get; set; }
}

public class QualityCheckRequest
{
    public string TransportTaskId { get; set; } = string.Empty;
    public QualityResult Result { get; set; }
    public string Conclusion { get; set; } = string.Empty;
    public string? RejectReason { get; set; }
    public string? Suggestions { get; set; }
}

public class QualityReportQueryRequest : CursorPagedQuery
{
    public QualityResult? Result { get; set; }
    public string? Keyword { get; set; }
    public string? TaskNo { get; set; }
    public string? InspectorId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
