using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class SensorThreshold
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MineId { get; set; }

    [ForeignKey(nameof(MineId))]
    public Mine? Mine { get; set; }

    [Required]
    public SensorType SensorType { get; set; }

    [MaxLength(100)]
    public string SensorCode { get; set; } = string.Empty;

    public decimal WarningThreshold { get; set; }

    public decimal CriticalThreshold { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SensorData
{
    [Key]
    public long Id { get; set; }

    [Required]
    public int MineId { get; set; }

    [Required]
    public SensorType SensorType { get; set; }

    [MaxLength(100)]
    public string SensorCode { get; set; } = string.Empty;

    public decimal Value { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class SafetyAlert
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MineId { get; set; }

    [ForeignKey(nameof(MineId))]
    public Mine? Mine { get; set; }

    [Required]
    public SensorType SensorType { get; set; }

    [MaxLength(100)]
    public string SensorCode { get; set; } = string.Empty;

    public decimal TriggerValue { get; set; }

    public AlertLevel Level { get; set; }

    public AlertStatus Status { get; set; } = AlertStatus.Created;

    public int? AssignedInspectorId { get; set; }

    [ForeignKey(nameof(AssignedInspectorId))]
    public User? AssignedInspector { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? AssignedAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public DateTime? EscalatedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    [MaxLength(2000)]
    public string? DisposalNote { get; set; }

    public int? EscalatedToId { get; set; }

    [ForeignKey(nameof(EscalatedToId))]
    public User? EscalatedTo { get; set; }

    public List<SafetyAlertDisposal> Disposals { get; set; } = [];
}

public class SafetyAlertDisposal
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int SafetyAlertId { get; set; }

    [ForeignKey(nameof(SafetyAlertId))]
    public SafetyAlert? SafetyAlert { get; set; }

    [Required]
    public int HandlerId { get; set; }

    [ForeignKey(nameof(HandlerId))]
    public User? Handler { get; set; }

    [MaxLength(2000)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Result { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
