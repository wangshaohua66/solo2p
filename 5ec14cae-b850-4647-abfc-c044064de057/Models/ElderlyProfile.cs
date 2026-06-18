using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class ElderlyProfile
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;

    public string Gender { get; set; } = string.Empty;

    public DateTime BirthDate { get; set; }

    public string IdCardNumber { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string Address { get; set; } = string.Empty;

    public List<string> MedicalHistory { get; set; } = new();

    public List<string> AllergyHistory { get; set; } = new();

    public string CareLevel { get; set; } = string.Empty;

    public CareLevelAssessment? CareLevelAssessment { get; set; }

    public List<EmergencyContact> EmergencyContacts { get; set; } = new();

    public string? BedId { get; set; }

    public string FacilityId { get; set; } = string.Empty;

    public string? ProfileImageUrl { get; set; }

    public List<Attachment> Attachments { get; set; } = new();

    public string Status { get; set; } = "Active";

    public DateTime CheckInDate { get; set; }

    public DateTime? CheckOutDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CareLevelAssessment
{
    public string AssessmentId { get; set; } = ObjectId.GenerateNewId().ToString();

    public DateTime AssessmentDate { get; set; }

    public string Assessor { get; set; } = string.Empty;

    public int DailyLivingScore { get; set; }

    public int MentalHealthScore { get; set; }

    public int SocialParticipationScore { get; set; }

    public string OverallLevel { get; set; } = string.Empty;

    public string? Notes { get; set; }
}

public class EmergencyContact
{
    public string Name { get; set; } = string.Empty;

    public string Relationship { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }

    public string? Email { get; set; }
}

public class Attachment
{
    public string AttachmentId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string FileName { get; set; } = string.Empty;

    public string FileType { get; set; } = string.Empty;

    public string FileUrl { get; set; } = string.Empty;

    public long FileSize { get; set; }

    public string Category { get; set; } = string.Empty;

    public DateTime UploadDate { get; set; } = DateTime.UtcNow;
}
