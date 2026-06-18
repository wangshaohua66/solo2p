using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class Bed
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string BedNumber { get; set; } = string.Empty;

    public string RoomNumber { get; set; } = string.Empty;

    public string Floor { get; set; } = string.Empty;

    public string Building { get; set; } = string.Empty;

    public string FacilityId { get; set; } = string.Empty;

    public string CareZone { get; set; } = string.Empty;

    public string BedType { get; set; } = "Standard";

    public string Status { get; set; } = "Available";

    public decimal DailyRate { get; set; }

    public string? ElderlyId { get; set; }

    public string? ElderlyName { get; set; }

    public DateTime? OccupiedDate { get; set; }

    public DateTime? ExpectedVacateDate { get; set; }

    public bool IsBooked { get; set; }

    public string? BookedByElderlyId { get; set; }

    public DateTime? BookingExpiryDate { get; set; }

    public DateTime? MaintenanceStartDate { get; set; }

    public DateTime? MaintenanceEndDate { get; set; }

    public string? MaintenanceNotes { get; set; }

    public List<BedHistory> History { get; set; } = new();

    public List<string> Facilities { get; set; } = new();

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class BedHistory
{
    public string HistoryId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Action { get; set; } = string.Empty;

    public string? ElderlyId { get; set; }

    public string? ElderlyName { get; set; }

    public DateTime ActionDate { get; set; } = DateTime.UtcNow;

    public string? OperatorName { get; set; }

    public string? Notes { get; set; }
}
