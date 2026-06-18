using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class TransportRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string TransportNo { get; set; } = string.Empty;

    public int EnterpriseId { get; set; }

    [ForeignKey(nameof(EnterpriseId))]
    public virtual Enterprise Enterprise { get; set; } = null!;

    public int ChemicalBatchId { get; set; }

    [ForeignKey(nameof(ChemicalBatchId))]
    public virtual ChemicalBatch ChemicalBatch { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string VehiclePlateNo { get; set; } = string.Empty;

    [MaxLength(50)]
    public string GpsDeviceId { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string DriverName { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string DriverLicenseNo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string DriverPhone { get; set; } = string.Empty;

    [MaxLength(50)]
    public string EscortName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string StartLocation { get; set; } = string.Empty;

    [MaxLength(500)]
    public string EndLocation { get; set; } = string.Empty;

    [Column(TypeName = "decimal(15,2)")]
    public decimal StartLongitude { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal StartLatitude { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal EndLongitude { get; set; }

    [Column(TypeName = "decimal(15,2)")]
    public decimal EndLatitude { get; set; }

    [MaxLength(2000)]
    public string? PlannedRoute { get; set; }

    public DateTime PlannedDepartureTime { get; set; }

    public DateTime? ActualDepartureTime { get; set; }

    public DateTime? ActualArrivalTime { get; set; }

    public TransportStatus Status { get; set; } = TransportStatus.Pending;

    [Column(TypeName = "decimal(10,2)")]
    public decimal CurrentSpeed { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal CurrentTemperature { get; set; }

    public bool IsDeviating { get; set; }

    public bool IsOverspeeding { get; set; }

    public bool IsTemperatureAbnormal { get; set; }

    public DateTime? DeviationStartTime { get; set; }

    public DateTime? OverspeedingStartTime { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ICollection<TransportTrajectory> Trajectories { get; set; } = new List<TransportTrajectory>();
}

public enum TransportStatus
{
    Pending = 1,
    Loading = 2,
    InTransit = 3,
    Deviating = 4,
    Delivered = 5,
    Completed = 6,
    Cancelled = 7
}
