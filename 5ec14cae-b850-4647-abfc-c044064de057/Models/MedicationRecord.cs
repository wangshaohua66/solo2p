using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class MedicationRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public string PrescriptionId { get; set; } = string.Empty;

    public string DrugName { get; set; } = string.Empty;

    public string GenericName { get; set; } = string.Empty;

    public string Dosage { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public string Route { get; set; } = "Oral";

    public List<AdministrationTime> AdministrationTimes { get; set; } = new();

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public string PrescribingDoctor { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public bool IsPRN { get; set; }

    public string? PRNCondition { get; set; }

    public string Status { get; set; } = "Active";

    public List<AdministrationLog> AdministrationLogs { get; set; } = new();

    public List<MedicationAlert> Alerts { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AdministrationTime
{
    public string TimeId { get; set; } = ObjectId.GenerateNewId().ToString();

    public TimeSpan ScheduledTime { get; set; }

    public string Description { get; set; } = string.Empty;
}

public class AdministrationLog
{
    public string LogId { get; set; } = ObjectId.GenerateNewId().ToString();

    public DateTime AdministrationDate { get; set; }

    public TimeSpan ScheduledTime { get; set; }

    public DateTime? ActualTime { get; set; }

    public string Status { get; set; } = "Pending";

    public string? AdministeredBy { get; set; }

    public string? AdministeredById { get; set; }

    public string? VerificationMethod { get; set; }

    public double? QrCodeData { get; set; }

    public string? ElderlyResponse { get; set; }

    public string? Notes { get; set; }

    public bool IsMissed { get; set; }

    public bool IsLate { get; set; }

    public int? LateMinutes { get; set; }

    public string? RefusalReason { get; set; }
}

public class MedicationAlert
{
    public string AlertId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string AlertType { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateTime AlertTime { get; set; } = DateTime.UtcNow;

    public bool IsAcknowledged { get; set; }

    public string? AcknowledgedBy { get; set; }

    public DateTime? AcknowledgedAt { get; set; }

    public string Severity { get; set; } = "Warning";
}

public class MedicationPrescription
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string PrescriptionNumber { get; set; } = string.Empty;

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public string FacilityId { get; set; } = string.Empty;

    public string DoctorId { get; set; } = string.Empty;

    public string DoctorName { get; set; } = string.Empty;

    public DateTime IssueDate { get; set; }

    public DateTime ExpiryDate { get; set; }

    public string Diagnosis { get; set; } = string.Empty;

    public List<MedicationItem> Medications { get; set; } = new();

    public string Status { get; set; } = "Active";

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MedicationItem
{
    public string ItemId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string DrugName { get; set; } = string.Empty;

    public string GenericName { get; set; } = string.Empty;

    public string Dosage { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public string Route { get; set; } = "Oral";

    public int Quantity { get; set; }

    public string Unit { get; set; } = "Tablet";

    public List<TimeSpan> AdministrationTimes { get; set; } = new();

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public string? Instructions { get; set; }
}

public class MedicationComplianceReport
{
    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public DateTime ReportStartDate { get; set; }

    public DateTime ReportEndDate { get; set; }

    public int TotalDoses { get; set; }

    public int AdministeredDoses { get; set; }

    public int MissedDoses { get; set; }

    public int LateDoses { get; set; }

    public int RefusedDoses { get; set; }

    public double ComplianceRate { get; set; }

    public List<DailyCompliance> DailyBreakdown { get; set; } = new();
}

public class DailyCompliance
{
    public DateTime Date { get; set; }

    public int TotalDoses { get; set; }

    public int AdministeredDoses { get; set; }

    public int MissedDoses { get; set; }

    public double Rate { get; set; }
}
