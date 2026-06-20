namespace FireIoTPlatform.Models.Entities;

public class MaintenanceRecord : BaseEntity
{
    public long ContractId { get; set; }
    public long FireUnitId { get; set; }
    public long? DeviceId { get; set; }
    public string MaintenanceType { get; set; } = string.Empty;
    public DateTime PlanDate { get; set; }
    public DateTime? ActualDate { get; set; }
    public string? Content { get; set; }
    public string? Result { get; set; }
    public bool IsQualified { get; set; } = true;
    public string? ProblemFound { get; set; }
    public string? Solution { get; set; }
    public string? Operator { get; set; }
    public string? OperatorPhone { get; set; }
    public string? Photos { get; set; }
    public string? Remark { get; set; }
    public int QualityScore { get; set; } = 100;
    public string? QualityComment { get; set; }
    public long? EvaluatedBy { get; set; }
    public DateTime? EvaluatedAt { get; set; }

    public MaintenanceContract? Contract { get; set; }
    public FireUnit? FireUnit { get; set; }
    public Device? Device { get; set; }
}
