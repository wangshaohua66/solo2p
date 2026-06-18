using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class HomeServiceOrder
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string OrderNumber { get; set; } = string.Empty;

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public string ElderlyPhone { get; set; } = string.Empty;

    public string ServiceAddress { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string Area { get; set; } = string.Empty;

    public string ServiceType { get; set; } = string.Empty;

    public List<string> ServiceItems { get; set; } = new();

    public string ServiceLevel { get; set; } = "Standard";

    public DateTime ScheduledDate { get; set; }

    public TimeSpan ScheduledStartTime { get; set; }

    public TimeSpan ScheduledEndTime { get; set; }

    public int EstimatedDurationMinutes { get; set; }

    public string? AssignedStaffId { get; set; }

    public string? AssignedStaffName { get; set; }

    public string? AssignedStaffPhone { get; set; }

    public string? DispatchNote { get; set; }

    public DateTime? DispatchedAt { get; set; }

    public DateTime? CheckInTime { get; set; }

    public string? CheckInLocation { get; set; }

    public double? CheckInLatitude { get; set; }

    public double? CheckInLongitude { get; set; }

    public DateTime? CheckOutTime { get; set; }

    public string? CheckOutLocation { get; set; }

    public int ActualDurationMinutes { get; set; }

    public List<ServicePhoto> ServicePhotos { get; set; } = new();

    public ServiceRecord? ServiceRecord { get; set; }

    public string Status { get; set; } = "Pending";

    public string Priority { get; set; } = "Normal";

    public string? Source { get; set; }

    public string? CreatedBy { get; set; }

    public string? CancelReason { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? CancelledBy { get; set; }

    public decimal ServiceFee { get; set; }

    public decimal MaterialFee { get; set; }

    public decimal TotalFee { get; set; }

    public string PaymentStatus { get; set; } = "Unpaid";

    public int SatisfactionScore { get; set; }

    public string? Feedback { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ServicePhoto
{
    public string PhotoId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string PhotoUrl { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime UploadTime { get; set; } = DateTime.UtcNow;

    public string UploadedBy { get; set; } = string.Empty;
}

public class ServiceRecord
{
    public string RecordId { get; set; } = ObjectId.GenerateNewId().ToString();

    public List<ServiceTask> Tasks { get; set; } = new();

    public string ServiceSummary { get; set; } = string.Empty;

    public string ElderlyCondition { get; set; } = string.Empty;

    public List<string> Recommendations { get; set; } = new();

    public string? NextServiceSuggestion { get; set; }

    public bool ElderlySigned { get; set; }

    public string? SignatureUrl { get; set; }

    public DateTime RecordDate { get; set; } = DateTime.UtcNow;
}

public class ServiceTask
{
    public string TaskId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string TaskName { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public bool Completed { get; set; }

    public int DurationMinutes { get; set; }

    public string? Notes { get; set; }
}

public class HomeServiceStaff
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public List<string> ServiceTypes { get; set; } = new();

    public List<string> ServiceAreas { get; set; } = new();

    public List<TimeRange> AvailableSlots { get; set; } = new();

    public int TotalServices { get; set; }

    public double AverageRating { get; set; }

    public string CurrentStatus { get; set; } = "Available";

    public string? CurrentOrderId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TimeRange
{
    public DayOfWeek DayOfWeek { get; set; }

    public TimeSpan StartTime { get; set; }

    public TimeSpan EndTime { get; set; }

    public bool IsAvailable { get; set; } = true;
}

public class DailyActivityRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public DateTime RecordDate { get; set; }

    public MealRecord Breakfast { get; set; } = new();

    public MealRecord Lunch { get; set; } = new();

    public MealRecord Dinner { get; set; } = new();

    public List<MedicationLogRecord> Medications { get; set; } = new();

    public List<ActivityLog> Activities { get; set; } = new();

    public List<HealthRecord> HealthMetrics { get; set; } = new();

    public List<FamilyNotification> Notifications { get; set; } = new();

    public string? OverallStatus { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MealRecord
{
    public string MealType { get; set; } = string.Empty;

    public TimeSpan ServedTime { get; set; }

    public string FoodItems { get; set; } = string.Empty;

    public string Consumption { get; set; } = string.Empty;

    public bool Completed { get; set; }

    public string? Notes { get; set; }
}

public class MedicationLogRecord
{
    public string MedicationName { get; set; } = string.Empty;

    public string Dosage { get; set; } = string.Empty;

    public TimeSpan ScheduledTime { get; set; }

    public DateTime? TakenTime { get; set; }

    public string Status { get; set; } = string.Empty;
}

public class ActivityLog
{
    public string ActivityId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string ActivityType { get; set; } = string.Empty;

    public string ActivityName { get; set; } = string.Empty;

    public DateTime StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    public string Location { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? Notes { get; set; }
}

public class HealthRecord
{
    public string MetricType { get; set; } = string.Empty;

    public decimal Value { get; set; }

    public string Unit { get; set; } = string.Empty;

    public DateTime RecordTime { get; set; }

    public string? Status { get; set; }
}

public class FamilyNotification
{
    public string NotificationId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Type { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; }

    public string Severity { get; set; } = "Info";
}

public class VisitAppointment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string AppointmentNumber { get; set; } = string.Empty;

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public string VisitorName { get; set; } = string.Empty;

    public string VisitorPhone { get; set; } = string.Empty;

    public string VisitorRelationship { get; set; } = string.Empty;

    public int VisitorCount { get; set; } = 1;

    public string VisitorIdCard { get; set; } = string.Empty;

    public DateTime VisitDate { get; set; }

    public TimeSpan StartTime { get; set; }

    public TimeSpan EndTime { get; set; }

    public string? SpecialRequirements { get; set; }

    public string Status { get; set; } = "Pending";

    public DateTime? CheckInTime { get; set; }

    public DateTime? CheckOutTime { get; set; }

    public string? CheckedInBy { get; set; }

    public string FamilyMessage { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DashboardStats
{
    public int TotalFacilities { get; set; }
    public int TotalNursingHomes { get; set; }
    public int TotalDayCareCenters { get; set; }
    public int TotalHomeServiceStations { get; set; }
    public int TotalElderly { get; set; }
    public int InHouseElderly { get; set; }
    public int HomeCareElderly { get; set; }
    public int TotalBeds { get; set; }
    public int OccupiedBeds { get; set; }
    public int AvailableBeds { get; set; }
    public int MaintenanceBeds { get; set; }
    public decimal OccupancyRate { get; set; }
    public int TotalStaff { get; set; }
    public int TodayShifts { get; set; }
    public int TodayOnDutyStaff { get; set; }
    public int TodayMedications { get; set; }
    public int TodayAdministeredMedications { get; set; }
    public int TodayMissedMedications { get; set; }
    public decimal MedicationComplianceRate { get; set; }
    public int TodayHomeServiceOrders { get; set; }
    public int TodayCompletedServices { get; set; }
    public int PendingServiceOrders { get; set; }
    public decimal MonthlyCollectionRate { get; set; }
    public decimal MonthlyTotalRevenue { get; set; }
    public decimal MonthlyOutstandingAmount { get; set; }
    public List<MonthlyTrendData> OccupancyTrends { get; set; } = new();
    public List<MonthlyTrendData> RevenueTrends { get; set; } = new();
    public List<CareZoneStats> CareZoneStats { get; set; } = new();
    public List<ServiceTypeStats> ServiceTypeStats { get; set; } = new();
}

public class MonthlyTrendData
{
    public string Month { get; set; } = string.Empty;
    public decimal Value { get; set; }
}

public class CareZoneStats
{
    public string ZoneName { get; set; } = string.Empty;
    public int ElderlyCount { get; set; }
    public int BedCount { get; set; }
    public int StaffCount { get; set; }
}

public class ServiceTypeStats
{
    public string ServiceType { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}
