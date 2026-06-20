using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FireTraining.Models;

public class Equipment
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(50)]
    public string? Unit { get; set; }

    public int TotalQuantity { get; set; }

    public int AvailableQuantity { get; set; }

    public int MaintenanceQuantity { get; set; }

    [MaxLength(255)]
    public string? Icon { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(100)]
    public string? Model { get; set; }

    [MaxLength(100)]
    public string? Manufacturer { get; set; }

    [Column(TypeName = "date")]
    public DateTime? PurchaseDate { get; set; }

    [Column(TypeName = "date")]
    public DateTime? LastMaintenanceDate { get; set; }

    [Column(TypeName = "date")]
    public DateTime? NextMaintenanceDate { get; set; }

    public EquipmentStatus Status { get; set; } = EquipmentStatus.Normal;

    [MaxLength(500)]
    public string? StorageLocation { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<EquipmentReservation>? Reservations { get; set; }
}

public enum EquipmentStatus
{
    Normal = 0,
    Maintenance = 1,
    Damaged = 2,
    Retired = 3
}

public class EquipmentReservation
{
    [Key]
    public int Id { get; set; }

    public int EquipmentId { get; set; }

    [ForeignKey(nameof(EquipmentId))]
    public Equipment? Equipment { get; set; }

    public int Quantity { get; set; }

    public int FireStationId { get; set; }

    [ForeignKey(nameof(FireStationId))]
    public FireStation? FireStation { get; set; }

    public int FirefighterId { get; set; }

    [ForeignKey(nameof(FirefighterId))]
    public Firefighter? Firefighter { get; set; }

    [MaxLength(200)]
    public string? ApplicantName { get; set; }

    [MaxLength(500)]
    public string? Purpose { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public int Priority { get; set; } = 1;

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    [MaxLength(500)]
    public string? RejectReason { get; set; }

    public int? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public DateTime? ActualPickupTime { get; set; }

    public DateTime? ActualReturnTime { get; set; }

    public bool IsOverdue { get; set; } = false;

    public bool OverdueNotified { get; set; } = false;

    public DateTime? OverdueNotifiedAt { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    public int? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

public enum ReservationStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    PickedUp = 3,
    Returned = 4,
    Overdue = 5,
    Cancelled = 6
}

public enum ReservationPriority
{
    Low = 1,
    Normal = 2,
    High = 3,
    Urgent = 4
}
