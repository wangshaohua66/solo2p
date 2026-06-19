using System.ComponentModel.DataAnnotations;

namespace MiningGovApi.Models.DTOs;

public class SensorDataSubmitDto
{
    [Required]
    public int MineId { get; set; }

    [Required]
    public SensorType SensorType { get; set; }

    [Required]
    public string SensorCode { get; set; } = string.Empty;

    [Required]
    public decimal Value { get; set; }
}

public class SensorDataBatchSubmitDto
{
    public List<SensorDataSubmitDto> DataList { get; set; } = [];
}

public class SafetyAlertHandleDto
{
    [Required]
    public int AlertId { get; set; }

    [Required]
    public string Action { get; set; } = string.Empty;

    public string? Result { get; set; }
}

public class SafetyAlertQueryDto : PagedQuery
{
    public int? MineId { get; set; }
    public AlertStatus? Status { get; set; }
    public AlertLevel? Level { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class SafetyAlertDto
{
    public int Id { get; set; }
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public SensorType SensorType { get; set; }
    public string SensorCode { get; set; } = string.Empty;
    public decimal TriggerValue { get; set; }
    public AlertLevel Level { get; set; }
    public AlertStatus Status { get; set; }
    public int? AssignedInspectorId { get; set; }
    public string? AssignedInspectorName { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public DateTime? EscalatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? DisposalNote { get; set; }
}

public class SensorThresholdDto
{
    public int Id { get; set; }
    public int MineId { get; set; }
    public SensorType SensorType { get; set; }
    public string SensorCode { get; set; } = string.Empty;
    public decimal WarningThreshold { get; set; }
    public decimal CriticalThreshold { get; set; }
    public bool IsEnabled { get; set; }
}

public class SensorThresholdCreateDto
{
    [Required]
    public int MineId { get; set; }

    [Required]
    public SensorType SensorType { get; set; }

    [Required]
    public string SensorCode { get; set; } = string.Empty;

    [Required]
    public decimal WarningThreshold { get; set; }

    [Required]
    public decimal CriticalThreshold { get; set; }
}
