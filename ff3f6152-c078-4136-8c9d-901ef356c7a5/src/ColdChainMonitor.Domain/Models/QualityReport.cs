using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class QualityReport
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("reportNo")]
    public string ReportNo { get; set; } = string.Empty;

    [BsonElement("transportTaskId")]
    public string TransportTaskId { get; set; } = string.Empty;

    [BsonElement("taskNo")]
    public string TaskNo { get; set; } = string.Empty;

    [BsonElement("drugBatch")]
    public DrugBatchInfo DrugBatch { get; set; } = new();

    [BsonElement("inspectorId")]
    public string InspectorId { get; set; } = string.Empty;

    [BsonElement("inspectorName")]
    public string InspectorName { get; set; } = string.Empty;

    [BsonElement("result")]
    public QualityResult Result { get; set; } = QualityResult.Pending;

    [BsonElement("temperatureSummary")]
    public TemperatureSummary TemperatureSummary { get; set; } = new();

    [BsonElement("alertSummary")]
    public AlertSummary AlertSummary { get; set; } = new();

    [BsonElement("conclusion")]
    public string Conclusion { get; set; } = string.Empty;

    [BsonElement("rejectReason")]
    public string? RejectReason { get; set; }

    [BsonElement("suggestions")]
    public string? Suggestions { get; set; }

    [BsonElement("attachments")]
    public List<string> Attachments { get; set; } = new();

    [BsonElement("inspectedAt")]
    public DateTime? InspectedAt { get; set; }

    [BsonElement("signedAt")]
    public DateTime? SignedAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class TemperatureSummary
{
    [BsonElement("avgTemperature")]
    public double AvgTemperature { get; set; }

    [BsonElement("maxTemperature")]
    public double MaxTemperature { get; set; }

    [BsonElement("minTemperature")]
    public double MinTemperature { get; set; }

    [BsonElement("avgHumidity")]
    public double? AvgHumidity { get; set; }

    [BsonElement("maxHumidity")]
    public double? MaxHumidity { get; set; }

    [BsonElement("minHumidity")]
    public double? MinHumidity { get; set; }

    [BsonElement("totalRecords")]
    public long TotalRecords { get; set; }

    [BsonElement("anomalyRecords")]
    public long AnomalyRecords { get; set; }

    [BsonElement("transportDurationMinutes")]
    public double TransportDurationMinutes { get; set; }

    [BsonElement("outOfRangeDurationMinutes")]
    public double OutOfRangeDurationMinutes { get; set; }

    [BsonElement("complianceRate")]
    public double ComplianceRate { get; set; }
}

public class AlertSummary
{
    [BsonElement("totalAlerts")]
    public int TotalAlerts { get; set; }

    [BsonElement("criticalAlerts")]
    public int CriticalAlerts { get; set; }

    [BsonElement("warningAlerts")]
    public int WarningAlerts { get; set; }

    [BsonElement("acknowledgedAlerts")]
    public int AcknowledgedAlerts { get; set; }

    [BsonElement("resolvedAlerts")]
    public int ResolvedAlerts { get; set; }

    [BsonElement("alertTypes")]
    public List<AlertTypeCount> AlertTypes { get; set; } = new();
}

public class AlertTypeCount
{
    [BsonElement("alertType")]
    public AlertType AlertType { get; set; }

    [BsonElement("count")]
    public int Count { get; set; }
}
