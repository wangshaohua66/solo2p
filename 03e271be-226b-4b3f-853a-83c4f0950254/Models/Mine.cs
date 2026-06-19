using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class Mine
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string RegistrationNo { get; set; } = string.Empty;

    [Required]
    public MineType MineType { get; set; }

    [MaxLength(500)]
    public string? Location { get; set; }

    [MaxLength(100)]
    public string? Area { get; set; }

    public decimal? Reserves { get; set; }

    [MaxLength(200)]
    public string? LegalRepresentative { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsActive { get; set; } = true;

    public List<MiningRight> MiningRights { get; set; } = [];
    public List<ProductionReport> ProductionReports { get; set; } = [];
    public List<SafetyAlert> SafetyAlerts { get; set; } = [];
    public List<SensorThreshold> SensorThresholds { get; set; } = [];
}
