using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class TransportTrajectory
{
    [Key]
    public long Id { get; set; }

    public int TransportRecordId { get; set; }

    [ForeignKey(nameof(TransportRecordId))]
    public virtual TransportRecord TransportRecord { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string GpsDeviceId { get; set; } = string.Empty;

    [Column(TypeName = "decimal(15,8)")]
    public decimal Longitude { get; set; }

    [Column(TypeName = "decimal(15,8)")]
    public decimal Latitude { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Speed { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Direction { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal Temperature { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal Humidity { get; set; }

    [MaxLength(200)]
    public string? LocationName { get; set; }

    public bool IsDeviation { get; set; }

    public bool IsOverspeeding { get; set; }

    public bool IsTemperatureAbnormal { get; set; }

    public DateTime RecordTime { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
