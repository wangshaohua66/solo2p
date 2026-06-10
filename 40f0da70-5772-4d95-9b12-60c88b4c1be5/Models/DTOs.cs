using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;

namespace CampHub.Models;

#region Account DTOs
public class LoginRequestDto
{
    [Required(ErrorMessage = "邮箱必填")]
    [EmailAddress(ErrorMessage = "邮箱格式不正确")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码必填")]
    [MinLength(6, ErrorMessage = "密码至少6位")]
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequestDto
{
    [Required(ErrorMessage = "邮箱必填")]
    [EmailAddress(ErrorMessage = "邮箱格式不正确")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "昵称必填")]
    [StringLength(20, MinimumLength = 2, ErrorMessage = "昵称2-20字")]
    public string Nickname { get; set; } = string.Empty;

    [Required(ErrorMessage = "密码必填")]
    [MinLength(6, ErrorMessage = "密码至少6位")]
    public string Password { get; set; } = string.Empty;

    [Compare("Password", ErrorMessage = "两次密码不一致")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class RefreshTokenRequestDto
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public int CreditScore { get; set; }
}
#endregion

#region Gear DTOs
public class GearQueryDto
{
    public string? Status { get; set; }
    public string? Category { get; set; }
    public string? OwnerId { get; set; }
    public string? Keyword { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 30;
}

public class GearCreateDto
{
    [Required]
    [StringLength(50, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Category { get; set; } = "其他";

    public string? Description { get; set; }
    public decimal PurchasePrice { get; set; }
    public int NextMaintenanceAfterUses { get; set; } = 20;
}

public class GearUpdateDto
{
    public string? Name { get; set; }
    public string? Category { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public int? NextMaintenanceAfterUses { get; set; }
    public int Version { get; set; }
    public int? BaseVersion { get; set; }
    public bool ForceLastWriteWins { get; set; }
}

public class GearLendDto
{
    [Required]
    public string BorrowerId { get; set; } = string.Empty;

    [Required]
    public DateTime DueDate { get; set; }

    public string? Notes { get; set; }
}

public class GearReturnDto
{
    public string Condition { get; set; } = "完好";
    public decimal? NewWearLevel { get; set; }
}

public class GearDto
{
    public string Id { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
    public UserDto? Owner { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PurchasePrice { get; set; }
    public int UsageCount { get; set; }
    public decimal WearLevel { get; set; }
    public DateTime? LastMaintenanceDate { get; set; }
    public int NextMaintenanceAfterUses { get; set; }
    public int UsesSinceMaintenance { get; set; }
    public string? CurrentBorrowerId { get; set; }
    public UserDto? CurrentBorrower { get; set; }
    public DateTime? DueDate { get; set; }
    public bool NeedsMaintenance { get; set; }
    public int Version { get; set; }
    public DateTime UpdatedAt { get; set; }
}
#endregion

#region Event DTOs
public class EventQueryDto
{
    public string? Status { get; set; }
    public string? Range { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class EventCreateDto
{
    [Required(ErrorMessage = "活动标题必填")]
    [StringLength(80, MinimumLength = 2)]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "目的地必填")]
    public string Destination { get; set; } = string.Empty;

    public decimal[]? GeoLocation { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    public int MaxParticipants { get; set; } = 20;
    public string? Description { get; set; }
    public List<ParticipantCreateDto>? Participants { get; set; }
}

public class ParticipantCreateDto
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = "参与者";
}

public class EventUpdateDto
{
    public string? Title { get; set; }
    public string? Destination { get; set; }
    public decimal[]? GeoLocation { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? MaxParticipants { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public int Version { get; set; }
    public int? BaseVersion { get; set; }
    public bool ForceLastWriteWins { get; set; }
}

public class EventRateDto
{
    [Range(1, 5)]
    public int TransportationScore { get; set; } = 3;

    [Range(1, 5)]
    public int SceneryScore { get; set; } = 3;

    [Range(1, 5)]
    public int FacilityScore { get; set; } = 3;

    [Range(1, 5)]
    public int SafetyScore { get; set; } = 3;

    [Range(1, 12)]
    public int Season { get; set; }

    public string DestinationTag { get; set; } = string.Empty;
    public string? Comments { get; set; }
}

public class EventDto
{
    public string Id { get; set; } = string.Empty;
    public string CreatorId { get; set; } = string.Empty;
    public UserDto? Creator { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public decimal[]? GeoLocation { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MaxParticipants { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CoverImage { get; set; } = string.Empty;
    public List<ParticipantDto> Participants { get; set; } = new();
    public List<EventGearDto> GearList { get; set; } = new();
    public List<PurchaseItemDto> PurchaseList { get; set; } = new();
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ParticipantDto
{
    public string UserId { get; set; } = string.Empty;
    public UserDto? User { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool Confirmed { get; set; }
}

public class EventGearDto
{
    public string Key { get; set; } = Guid.NewGuid().ToString("N");
    public string? GearId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? BroughtByUserId { get; set; }
    public UserDto? BroughtByUser { get; set; }
    public bool Checked { get; set; }
}

public class PurchaseItemDto
{
    public string Key { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? AssignedToUserId { get; set; }
    public bool Purchased { get; set; }
}

public class RecommendResponseDto
{
    public List<EventGearDto> GearList { get; set; } = new();
    public List<PurchaseItemDto> PurchaseList { get; set; } = new();
    public double Similarity { get; set; }
    public string? BasedOnEventTitle { get; set; }
}
#endregion

#region Photo DTOs
public class PhotoUploadResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ThumbUrl { get; set; } = string.Empty;
    public decimal? GPS_Lat { get; set; }
    public decimal? GPS_Lng { get; set; }
    public DateTime? TakenAt { get; set; }
}

public class PhotoDto
{
    public string Id { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string UploaderId { get; set; } = string.Empty;
    public UserDto? Uploader { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string ThumbUrl { get; set; } = string.Empty;
    public decimal? GPS_Lat { get; set; }
    public decimal? GPS_Lng { get; set; }
    public DateTime? TakenAt { get; set; }
    public DateTime UploadedAt { get; set; }
    public string Caption { get; set; } = string.Empty;
}
#endregion

#region Stats DTOs
public class StatsOverviewDto
{
    public int TotalEvents { get; set; }
    public int TotalGear { get; set; }
    public int PendingReturns { get; set; }
    public int TotalPhotos { get; set; }
    public int MyCreditScore { get; set; }
}

public class SeasonalityCellDto
{
    public int Month { get; set; }
    public string DestinationTag { get; set; } = string.Empty;
    public double AvgScore { get; set; }
    public int SampleCount { get; set; }
}

public class CreditRankDto
{
    public UserDto User { get; set; } = new();
    public int Rank { get; set; }
    public int Score { get; set; }
    public int LendCount { get; set; }
    public int OnTimeRate { get; set; }
}
#endregion

#region ViewModels (Razor强类型)
public class LoginViewModel
{
    public string ReturnUrl { get; set; } = "/";
}

public class HomeViewModel
{
    public StatsOverviewDto Stats { get; set; } = new();
    public List<EventDto> UpcomingEvents { get; set; } = new();
    public List<EventDto> OngoingEvents { get; set; } = new();
    public List<GearDto> MyGearPending { get; set; } = new();
    public List<BorrowRecord> OverdueLends { get; set; } = new();
}

public class GearIndexViewModel
{
    public List<string> AllCategories { get; set; } = GearCategories.All.ToList();
    public List<string> AllStatuses { get; set; } = new()
    {
        GearStatus.Available, GearStatus.Lent, GearStatus.Repair, GearStatus.Scrap
    };
    public List<UserDto> AllOwners { get; set; } = new();
}

public class EventDetailsViewModel
{
    public EventDto Event { get; set; } = new();
    public List<RatingDto> Ratings { get; set; } = new();
}

public class RatingDto
{
    public string UserId { get; set; } = string.Empty;
    public UserDto? User { get; set; }
    public int TransportationScore { get; set; }
    public int SceneryScore { get; set; }
    public int FacilityScore { get; set; }
    public int SafetyScore { get; set; }
    public string Comments { get; set; } = string.Empty;
}
#endregion

#region Common
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string msg = "") =>
        new() { Success = true, Message = msg, Data = data };

    public static ApiResponse<T> Fail(string msg) =>
        new() { Success = false, Message = msg };
}

public class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;

    public static ApiResponse Ok(string msg = "") =>
        new() { Success = true, Message = msg };

    public static ApiResponse Fail(string msg) =>
        new() { Success = false, Message = msg };
}
#endregion
