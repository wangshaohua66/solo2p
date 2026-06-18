using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SmartParking.API.Common;

namespace SmartParking.API.Models.Entities;

public abstract class BaseEntity
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("is_deleted")]
    public bool IsDeleted { get; set; } = false;
}

[Table("users")]
public class User : BaseEntity
{
    [Column("username")]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Column("nickname")]
    [MaxLength(50)]
    public string Nickname { get; set; } = string.Empty;

    [Column("password_hash")]
    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("phone")]
    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [Column("email")]
    [MaxLength(100)]
    public string? Email { get; set; }

    [Column("role")]
    public UserRole Role { get; set; } = UserRole.CarOwner;

    [Column("avatar")]
    [MaxLength(500)]
    public string? Avatar { get; set; }

    [Column("member_level")]
    public int MemberLevel { get; set; } = 0;

    [Column("balance")]
    [Precision(18, 2)]
    public decimal Balance { get; set; } = 0;

    [Column("refresh_token")]
    [MaxLength(500)]
    public string? RefreshToken { get; set; }

    [Column("refresh_token_expires")]
    public DateTime? RefreshTokenExpires { get; set; }
}

[Table("parking_lots")]
public class ParkingLot : BaseEntity
{
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("area")]
    [MaxLength(100)]
    public string Area { get; set; } = string.Empty;

    [Column("total_spots")]
    public int TotalSpots { get; set; }

    [Column("latitude")]
    [Precision(10, 6)]
    public decimal Latitude { get; set; }

    [Column("longitude")]
    [Precision(10, 6)]
    public decimal Longitude { get; set; }

    public virtual ICollection<ParkingFloor> Floors { get; set; } = new List<ParkingFloor>();
}

[Table("parking_floors")]
public class ParkingFloor : BaseEntity
{
    [Column("parking_lot_id")]
    [MaxLength(50)]
    public string ParkingLotId { get; set; } = string.Empty;

    [Column("name")]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [Column("level")]
    public int Level { get; set; }

    [Column("total_spots")]
    public int TotalSpots { get; set; }

    [ForeignKey(nameof(ParkingLotId))]
    public virtual ParkingLot? ParkingLot { get; set; }

    public virtual ICollection<ParkingSpot> Spots { get; set; } = new List<ParkingSpot>();
}

[Table("parking_spots")]
public class ParkingSpot : BaseEntity
{
    [Column("code")]
    [MaxLength(30)]
    public string Code { get; set; } = string.Empty;

    [Column("floor_id")]
    [MaxLength(50)]
    public string FloorId { get; set; } = string.Empty;

    [Column("status")]
    public ParkingSpotStatus Status { get; set; } = ParkingSpotStatus.Available;

    [Column("x")]
    public int X { get; set; }

    [Column("y")]
    public int Y { get; set; }

    [Column("width")]
    public int Width { get; set; } = 60;

    [Column("height")]
    public int Height { get; set; } = 100;

    [Column("plate_number")]
    [MaxLength(20)]
    public string? PlateNumber { get; set; }

    [Column("entry_time")]
    public DateTime? EntryTime { get; set; }

    [Column("reservation_id")]
    [MaxLength(50)]
    public string? ReservationId { get; set; }

    [Column("last_heartbeat")]
    public DateTime? LastHeartbeat { get; set; }

    [ForeignKey(nameof(FloorId))]
    public virtual ParkingFloor? Floor { get; set; }
}

[Table("parking_records")]
public class ParkingRecord : BaseEntity
{
    [Column("spot_id")]
    [MaxLength(50)]
    public string SpotId { get; set; } = string.Empty;

    [Column("spot_code")]
    [MaxLength(30)]
    public string SpotCode { get; set; } = string.Empty;

    [Column("plate_number")]
    [MaxLength(20)]
    public string PlateNumber { get; set; } = string.Empty;

    [Column("user_id")]
    [MaxLength(50)]
    public string? UserId { get; set; }

    [Column("entry_time")]
    public DateTime EntryTime { get; set; } = DateTime.UtcNow;

    [Column("exit_time")]
    public DateTime? ExitTime { get; set; }

    [Column("duration_minutes")]
    public int? DurationMinutes { get; set; }

    [Column("parking_fee")]
    [Precision(18, 2)]
    public decimal? ParkingFee { get; set; }

    [Column("status")]
    public string Status { get; set; } = "InProgress";
}

[Table("charging_stations")]
public class ChargingStation : BaseEntity
{
    [Column("code")]
    [MaxLength(30)]
    public string Code { get; set; } = string.Empty;

    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("type")]
    public ChargingStationType Type { get; set; } = ChargingStationType.AC;

    [Column("power")]
    public int Power { get; set; }

    [Column("status")]
    public ChargingStationStatus Status { get; set; } = ChargingStationStatus.Idle;

    [Column("current_power")]
    [Precision(10, 2)]
    public decimal? CurrentPower { get; set; }

    [Column("charged_kwh")]
    [Precision(10, 2)]
    public decimal? ChargedKwh { get; set; }

    [Column("location")]
    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [Column("parking_lot_id")]
    [MaxLength(50)]
    public string ParkingLotId { get; set; } = string.Empty;

    [Column("price_per_kwh")]
    [Precision(10, 4)]
    public decimal PricePerKwh { get; set; } = 1.5m;

    [Column("last_heartbeat")]
    public DateTime? LastHeartbeat { get; set; }
}

[Table("charging_reservations")]
public class ChargingReservation : BaseEntity
{
    [Column("station_id")]
    [MaxLength(50)]
    public string StationId { get; set; } = string.Empty;

    [Column("station_code")]
    [MaxLength(30)]
    public string StationCode { get; set; } = string.Empty;

    [Column("user_id")]
    [MaxLength(50)]
    public string UserId { get; set; } = string.Empty;

    [Column("start_time")]
    public DateTime StartTime { get; set; }

    [Column("end_time")]
    public DateTime EndTime { get; set; }

    [Column("status")]
    public string Status { get; set; } = "Active";

    [Column("expire_notified")]
    public bool ExpireNotified { get; set; } = false;
}

[Table("charging_sessions")]
public class ChargingSession : BaseEntity
{
    [Column("station_id")]
    [MaxLength(50)]
    public string StationId { get; set; } = string.Empty;

    [Column("user_id")]
    [MaxLength(50)]
    public string UserId { get; set; } = string.Empty;

    [Column("start_time")]
    public DateTime StartTime { get; set; } = DateTime.UtcNow;

    [Column("end_time")]
    public DateTime? EndTime { get; set; }

    [Column("start_kwh")]
    [Precision(10, 2)]
    public decimal StartKwh { get; set; }

    [Column("end_kwh")]
    [Precision(10, 2)]
    public decimal? EndKwh { get; set; }

    [Column("total_kwh")]
    [Precision(10, 2)]
    public decimal? TotalKwh { get; set; }

    [Column("cost")]
    [Precision(18, 2)]
    public decimal? Cost { get; set; }

    [Column("status")]
    public string Status { get; set; } = "Charging";
}

[Table("billing_rules")]
public class BillingRule : BaseEntity
{
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("type")]
    public BillingRuleType Type { get; set; }

    [Column("priority")]
    public int Priority { get; set; } = 100;

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Column("daily_cap")]
    [Precision(18, 2)]
    public decimal? DailyCap { get; set; }

    public virtual ICollection<TimeSlotRate> TimeSlots { get; set; } = new List<TimeSlotRate>();
    public virtual ICollection<MemberDiscount> MemberDiscounts { get; set; } = new List<MemberDiscount>();
    public virtual ICollection<ChargingTier> ChargingTiers { get; set; } = new List<ChargingTier>();
}

[Table("time_slot_rates")]
public class TimeSlotRate
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Column("rule_id")]
    [MaxLength(50)]
    public string RuleId { get; set; } = string.Empty;

    [Column("start_time")]
    [MaxLength(10)]
    public string StartTime { get; set; } = "00:00";

    [Column("end_time")]
    [MaxLength(10)]
    public string EndTime { get; set; } = "24:00";

    [Column("rate_per_hour")]
    [Precision(10, 4)]
    public decimal RatePerHour { get; set; }

    [ForeignKey(nameof(RuleId))]
    public virtual BillingRule? Rule { get; set; }
}

[Table("member_discounts")]
public class MemberDiscount
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Column("rule_id")]
    [MaxLength(50)]
    public string RuleId { get; set; } = string.Empty;

    [Column("level")]
    public int Level { get; set; }

    [Column("discount_rate")]
    [Precision(5, 4)]
    public decimal DiscountRate { get; set; } = 1.0m;

    [ForeignKey(nameof(RuleId))]
    public virtual BillingRule? Rule { get; set; }
}

[Table("charging_tiers")]
public class ChargingTier
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Column("rule_id")]
    [MaxLength(50)]
    public string RuleId { get; set; } = string.Empty;

    [Column("min_kwh")]
    [Precision(10, 2)]
    public decimal MinKwh { get; set; }

    [Column("max_kwh")]
    [Precision(10, 2)]
    public decimal? MaxKwh { get; set; }

    [Column("rate_per_kwh")]
    [Precision(10, 4)]
    public decimal RatePerKwh { get; set; }

    [ForeignKey(nameof(RuleId))]
    public virtual BillingRule? Rule { get; set; }
}

[Table("payment_orders")]
public class PaymentOrder : BaseEntity
{
    [Column("order_no")]
    [MaxLength(50)]
    public string OrderNo { get; set; } = string.Empty;

    [Column("user_id")]
    [MaxLength(50)]
    public string UserId { get; set; } = string.Empty;

    [Column("type")]
    [MaxLength(30)]
    public string Type { get; set; } = "Parking";

    [Column("related_id")]
    [MaxLength(50)]
    public string RelatedId { get; set; } = string.Empty;

    [Column("amount")]
    [Precision(18, 2)]
    public decimal Amount { get; set; }

    [Column("status")]
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    [Column("payment_method")]
    public PaymentMethod? PaymentMethod { get; set; }

    [Column("paid_at")]
    public DateTime? PaidAt { get; set; }

    [Column("transaction_id")]
    [MaxLength(100)]
    public string? TransactionId { get; set; }

    [Column("refund_amount")]
    [Precision(18, 2)]
    public decimal? RefundAmount { get; set; }

    [Column("description")]
    [MaxLength(500)]
    public string? Description { get; set; }
}

[Table("work_orders")]
public class WorkOrder : BaseEntity
{
    [Column("order_no")]
    [MaxLength(50)]
    public string OrderNo { get; set; } = string.Empty;

    [Column("type")]
    [MaxLength(30)]
    public string Type { get; set; } = "Other";

    [Column("title")]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(2000)]
    public string? Description { get; set; }

    [Column("photos")]
    [MaxLength(2000)]
    public string? PhotosJson { get; set; }

    [Column("status")]
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Pending;

    [Column("reporter_id")]
    [MaxLength(50)]
    public string ReporterId { get; set; } = string.Empty;

    [Column("assignee_id")]
    [MaxLength(50)]
    public string? AssigneeId { get; set; }

    [Column("location")]
    [MaxLength(200)]
    public string? Location { get; set; }

    [Column("plate_number")]
    [MaxLength(20)]
    public string? PlateNumber { get; set; }
}
