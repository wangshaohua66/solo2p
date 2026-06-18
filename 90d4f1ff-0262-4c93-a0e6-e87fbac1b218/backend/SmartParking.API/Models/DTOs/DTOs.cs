using SmartParking.API.Common;

namespace SmartParking.API.Models.DTOs;

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
    public int ExpiresIn { get; set; }
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public UserRole Role { get; set; }
    public string? Avatar { get; set; }
    public int? MemberLevel { get; set; }
    public decimal Balance { get; set; }
}

public class ParkingLotDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public int TotalSpots { get; set; }
    public int AvailableSpots { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public List<ParkingFloorDto> Floors { get; set; } = new();
}

public class ParkingFloorDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Level { get; set; }
    public int TotalSpots { get; set; }
    public int AvailableSpots { get; set; }
    public List<ParkingSpotDto> Spots { get; set; } = new();
}

public class ParkingSpotDto
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string FloorId { get; set; } = string.Empty;
    public ParkingSpotStatus Status { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string? PlateNumber { get; set; }
    public DateTime? EntryTime { get; set; }
    public string? ReservationId { get; set; }
    public DateTime? LastHeartbeat { get; set; }
}

public class ParkingRecordDto
{
    public string Id { get; set; } = string.Empty;
    public string SpotId { get; set; } = string.Empty;
    public string SpotCode { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public DateTime? ExitTime { get; set; }
    public int? DurationMinutes { get; set; }
    public decimal? ParkingFee { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class ParkingEntryRequest
{
    public string SpotId { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
}

public class ParkingExitRequest
{
    public string RecordId { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
}

public class ChargingStationDto
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ChargingStationType Type { get; set; }
    public int Power { get; set; }
    public ChargingStationStatus Status { get; set; }
    public decimal? CurrentPower { get; set; }
    public decimal? ChargedKwh { get; set; }
    public string Location { get; set; } = string.Empty;
    public string ParkingLotId { get; set; } = string.Empty;
    public decimal PricePerKwh { get; set; }
    public DateTime? LastHeartbeat { get; set; }
}

public class ChargingReservationDto
{
    public string Id { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateReservationRequest
{
    public string StationId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class ChargingSessionDto
{
    public string Id { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal StartKwh { get; set; }
    public decimal? EndKwh { get; set; }
    public decimal? TotalKwh { get; set; }
    public decimal? Cost { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class BillingCalculationRequest
{
    public string? RecordId { get; set; }
    public DateTime EntryTime { get; set; }
    public DateTime ExitTime { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public int? MemberLevel { get; set; }
}

public class ChargingBillingRequest
{
    public decimal Kwh { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? MemberLevel { get; set; }
}

public class BillingCalculationDto
{
    public decimal BaseAmount { get; set; }
    public decimal ParkingAmount { get; set; }
    public decimal ChargingAmount { get; set; }
    public decimal MemberDiscount { get; set; }
    public decimal TotalAmount { get; set; }
    public bool DailyCapApplied { get; set; }
    public List<BillingDetailDto> Details { get; set; } = new();
}

public class BillingDetailDto
{
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
}

public class BillingRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public BillingRuleType Type { get; set; }
    public int Priority { get; set; }
    public bool IsEnabled { get; set; }
    public decimal? DailyCap { get; set; }
    public List<TimeSlotRateDto> TimeSlots { get; set; } = new();
    public List<MemberDiscountDto> MemberDiscounts { get; set; } = new();
    public List<ChargingTierDto> ChargingTiers { get; set; } = new();
}

public class TimeSlotRateDto
{
    public string? Id { get; set; }
    public string StartTime { get; set; } = "00:00";
    public string EndTime { get; set; } = "24:00";
    public decimal RatePerHour { get; set; }
}

public class MemberDiscountDto
{
    public string? Id { get; set; }
    public int Level { get; set; }
    public decimal DiscountRate { get; set; }
}

public class ChargingTierDto
{
    public string? Id { get; set; }
    public decimal MinKwh { get; set; }
    public decimal? MaxKwh { get; set; }
    public decimal RatePerKwh { get; set; }
}

public class PaymentOrderDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderNo { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string RelatedId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public OrderStatus Status { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreatePaymentOrderRequest
{
    public string Type { get; set; } = "Parking";
    public string RelatedId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
}

public class PayOrderRequest
{
    public PaymentMethod Method { get; set; }
}

public class RefundRequest
{
    public string OrderId { get; set; } = string.Empty;
    public decimal? RefundAmount { get; set; }
    public string? Reason { get; set; }
    public bool FullRefund { get; set; } = true;
}

public class WorkOrderDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderNo { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Photos { get; set; } = new();
    public WorkOrderStatus Status { get; set; }
    public string ReporterId { get; set; } = string.Empty;
    public string? AssigneeId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? Location { get; set; }
    public string? PlateNumber { get; set; }
}

public class CreateWorkOrderRequest
{
    public string Type { get; set; } = "Other";
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Photos { get; set; } = new();
    public string? Location { get; set; }
    public string? PlateNumber { get; set; }
}

public class AssignWorkOrderRequest
{
    public string AssigneeId { get; set; } = string.Empty;
}

public class UpdateWorkOrderStatusRequest
{
    public WorkOrderStatus Status { get; set; }
}

public class ToggleRuleRequest
{
    public bool IsEnabled { get; set; }
}

public class PeakHourDto
{
    public int Hour { get; set; }
    public int Count { get; set; }
}

public class TrendDataDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public decimal? CompareValue { get; set; }
}

public class RankingDataDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Value { get; set; }
}

public class DashboardStatsDto
{
    public decimal TodayRevenue { get; set; }
    public decimal YesterdayRevenue { get; set; }
    public decimal WeekRevenue { get; set; }
    public decimal MonthRevenue { get; set; }
    public int TotalParkings { get; set; }
    public int TotalChargings { get; set; }
    public decimal AvgParkingDuration { get; set; }
    public decimal OccupancyRate { get; set; }
    public decimal ChargingUtilization { get; set; }
    public List<PeakHourDto> PeakHours { get; set; } = new();
    public List<TrendDataDto> RevenueTrend { get; set; } = new();
    public List<TrendDataDto> ParkingTrend { get; set; } = new();
    public List<TrendDataDto> ChargingTrend { get; set; } = new();
    public List<RankingDataDto> TopParkingLots { get; set; } = new();
    public List<RankingDataDto> TopStations { get; set; } = new();
}

public class AvailableSlotDto
{
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public bool Available { get; set; } = true;
}

public class PayOrderResponse
{
    public string? PayUrl { get; set; }
    public string? QrCode { get; set; }
}

public class GenerateInvoiceResponse
{
    public string InvoiceUrl { get; set; } = string.Empty;
    public string InvoiceNo { get; set; } = string.Empty;
}
