using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HazChemSupervision.Models;

public class ProcessRecord
{
    [Key]
    public int Id { get; set; }

    public int ChemicalBatchId { get; set; }

    [ForeignKey(nameof(ChemicalBatchId))]
    public virtual ChemicalBatch ChemicalBatch { get; set; } = null!;

    public ProcessStage Stage { get; set; }

    public int OperatorId { get; set; }

    [MaxLength(50)]
    public string OperatorName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? CertificateNo { get; set; }

    [MaxLength(50)]
    public string? CertificateType { get; set; }

    public DateTime? CertificateExpiryDate { get; set; }

    public bool CertificateValidated { get; set; }

    public string? ValidationResult { get; set; }

    [MaxLength(2000)]
    public string? OperationRecord { get; set; }

    [MaxLength(200)]
    public string? AttachmentUrl { get; set; }

    public ProcessStatus Status { get; set; } = ProcessStatus.Pending;

    [NotMapped]
    public string StageName => Stage.ToString();

    [NotMapped]
    public string StatusName => Status.ToString();

    public DateTime? StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    [MaxLength(500)]
    public string? Remark { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum ProcessStage
{
    BatchCreated = 0,
    RawMaterialInbound = 1,
    ProductionProcessing = 2,
    FinishedInspection = 3,
    InStorage = 4,
    OutboundReview = 5,
    InTransit = 6,
    Delivered = 7
}

public enum ProcessStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
    Failed = 4,
    Cancelled = 5
}
