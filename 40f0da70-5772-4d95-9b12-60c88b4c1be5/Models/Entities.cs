using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace CampHub.Models;

#region User & Auth
public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("passwordHash")]
    public string PasswordHash { get; set; } = string.Empty;

    [BsonElement("nickname")]
    public string Nickname { get; set; } = string.Empty;

    [BsonElement("avatarUrl")]
    public string AvatarUrl { get; set; } = string.Empty;

    [BsonElement("creditScore")]
    public int CreditScore { get; set; } = 100;

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("currentRefreshTokenId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? CurrentRefreshTokenId { get; set; }
}

public class RefreshToken
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("token")]
    public string Token { get; set; } = string.Empty;

    [BsonElement("expiresAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("revoked")]
    public bool Revoked { get; set; }

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreditLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("delta")]
    public int Delta { get; set; }

    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
#endregion

#region Gear
public static class GearStatus
{
    public const string Available = "在库";
    public const string Lent = "借出";
    public const string Repair = "维修中";
    public const string Scrap = "报废";
}

public static class GearCategories
{
    public static readonly string[] All = new[]
    {
        "帐篷", "天幕", "睡袋", "防潮垫", "桌椅", "炉具", "炊具",
        "灯具", "冷藏", "背包", "水具", "服装", "工具", "电子", "其他"
    };
}

public class Gear
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("ownerId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string OwnerId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? Owner { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = "其他";

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("imageUrl")]
    public string ImageUrl { get; set; } = string.Empty;

    [BsonElement("status")]
    public string Status { get; set; } = GearStatus.Available;

    [BsonElement("purchasePrice")]
    public decimal PurchasePrice { get; set; }

    [BsonElement("usageCount")]
    public int UsageCount { get; set; }

    [BsonElement("wearLevel")]
    public decimal WearLevel { get; set; } = 0;

    [BsonElement("lastMaintenanceDate")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? LastMaintenanceDate { get; set; }

    [BsonElement("lastMaintenanceUsageCount")]
    public int LastMaintenanceUsageCount { get; set; }

    [BsonElement("nextMaintenanceAfterUses")]
    public int NextMaintenanceAfterUses { get; set; } = 20;

    [BsonElement("currentBorrowerId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? CurrentBorrowerId { get; set; }

    [BsonElement("dueDate")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? DueDate { get; set; }

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("_version")]
    public int Version { get; set; } = 1;

    [BsonIgnore]
    public int UsesSinceMaintenance => UsageCount - LastMaintenanceUsageCount;

    [BsonIgnore]
    public bool NeedsMaintenance =>
        UsesSinceMaintenance >= NextMaintenanceAfterUses && NextMaintenanceAfterUses > 0;
}

public class BorrowRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("gearId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string GearId { get; set; } = string.Empty;

    [BsonIgnore]
    public Gear? Gear { get; set; }

    [BsonElement("lenderId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string LenderId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? Lender { get; set; }

    [BsonElement("borrowerId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string BorrowerId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? Borrower { get; set; }

    [BsonElement("borrowDate")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime BorrowDate { get; set; } = DateTime.UtcNow;

    [BsonElement("dueDate")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime DueDate { get; set; }

    [BsonElement("actualReturnDate")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ActualReturnDate { get; set; }

    [BsonElement("returnCondition")]
    public string ReturnCondition { get; set; } = string.Empty;

    [BsonElement("creditChange")]
    public int CreditChange { get; set; }

    [BsonElement("notes")]
    public string Notes { get; set; } = string.Empty;
}
#endregion

#region Event
public static class EventStatus
{
    public const string Planning = "筹备";
    public const string Ongoing = "进行";
    public const string Finished = "结束";
    public const string Archived = "归档";
}

public class CampEvent
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("creatorId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CreatorId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? Creator { get; set; }

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("destination")]
    public string Destination { get; set; } = string.Empty;

    [BsonElement("geoLocation")]
    public decimal[]? GeoLocation { get; set; }

    [BsonElement("startTime")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime StartTime { get; set; }

    [BsonElement("endTime")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime EndTime { get; set; }

    [BsonElement("maxParticipants")]
    public int MaxParticipants { get; set; } = 20;

    [BsonElement("status")]
    public string Status { get; set; } = EventStatus.Planning;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("coverImage")]
    public string CoverImage { get; set; } = string.Empty;

    [BsonElement("participants")]
    public List<Participant> Participants { get; set; } = new();

    [BsonElement("gearList")]
    public List<EventGear> GearList { get; set; } = new();

    [BsonElement("purchaseList")]
    public List<PurchaseItem> PurchaseList { get; set; } = new();

    [BsonElement("_version")]
    public int Version { get; set; } = 1;

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Participant
{
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? User { get; set; }

    [BsonElement("role")]
    public string Role { get; set; } = "参与者";

    [BsonElement("confirmed")]
    public bool Confirmed { get; set; } = false;

    [BsonElement("joinedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class EventGear
{
    [BsonElement("gearId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? GearId { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = "其他";

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("broughtByUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? BroughtByUserId { get; set; }

    [BsonIgnore]
    public User? BroughtByUser { get; set; }

    [BsonElement("checked")]
    public bool Checked { get; set; } = false;
}

public class PurchaseItem
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = "食物";

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("unit")]
    public string Unit { get; set; } = "份";

    [BsonElement("assignedToUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? AssignedToUserId { get; set; }

    [BsonElement("purchased")]
    public bool Purchased { get; set; } = false;
}

public class Rating
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("eventId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string EventId { get; set; } = string.Empty;

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("transportationScore")]
    public int TransportationScore { get; set; } = 3;

    [BsonElement("sceneryScore")]
    public int SceneryScore { get; set; } = 3;

    [BsonElement("facilityScore")]
    public int FacilityScore { get; set; } = 3;

    [BsonElement("safetyScore")]
    public int SafetyScore { get; set; } = 3;

    [BsonElement("season")]
    public int Season { get; set; }

    [BsonElement("destinationTag")]
    public string DestinationTag { get; set; } = string.Empty;

    [BsonElement("comments")]
    public string Comments { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
#endregion

#region Photo
public class Photo
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("eventId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string EventId { get; set; } = string.Empty;

    [BsonElement("uploaderId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UploaderId { get; set; } = string.Empty;

    [BsonIgnore]
    public User? Uploader { get; set; }

    [BsonElement("fileUrl")]
    public string FileUrl { get; set; } = string.Empty;

    [BsonElement("thumbUrl")]
    public string ThumbUrl { get; set; } = string.Empty;

    [BsonElement("gpsLat")]
    public decimal? GPS_Lat { get; set; }

    [BsonElement("gpsLng")]
    public decimal? GPS_Lng { get; set; }

    [BsonElement("takenAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? TakenAt { get; set; }

    [BsonElement("uploadedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("caption")]
    public string Caption { get; set; } = string.Empty;
}
#endregion
