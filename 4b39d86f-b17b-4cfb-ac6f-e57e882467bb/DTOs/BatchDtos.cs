namespace HazChemSupervision.DTOs;

public class ChemicalBatchDto
{
    public int Id { get; set; }
    public string BatchNo { get; set; } = string.Empty;
    public int ChemicalId { get; set; }
    public string ChemicalName { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int? WarehouseId { get; set; }
    public string? WarehouseName { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateTime ProductionDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime? RawMaterialInboundTime { get; set; }
    public int? RawMaterialOperatorId { get; set; }
    public string? RawMaterialOperatorName { get; set; }
    public string? RawMaterialRemark { get; set; }
    public DateTime? ProductionStartTime { get; set; }
    public DateTime? ProductionEndTime { get; set; }
    public int? ProductionOperatorId { get; set; }
    public string? ProductionOperatorName { get; set; }
    public string? ProductionProcessRecord { get; set; }
    public DateTime? InspectionTime { get; set; }
    public int? InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public string? InspectionReportUrl { get; set; }
    public string? InspectionResult { get; set; }
    public bool? InspectionPassed { get; set; }
    public DateTime? OutboundReviewTime { get; set; }
    public int? OutboundReviewerId { get; set; }
    public string? OutboundReviewerName { get; set; }
    public string? OutboundRemark { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ChemicalBatchCreateDto
{
    public string BatchNo { get; set; } = string.Empty;
    public int ChemicalId { get; set; }
    public int EnterpriseId { get; set; }
    public int? WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateTime ProductionDate { get; set; }
    public DateTime ExpiryDate { get; set; }
}

public class BatchStageProcessDto
{
    public int OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public string? CertificateNo { get; set; }
    public string? CertificateType { get; set; }
    public string? OperationRecord { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? Remark { get; set; }
}

public class RawMaterialInboundDto : BatchStageProcessDto
{
    public int WarehouseId { get; set; }
    public decimal Quantity { get; set; }
}

public class ProductionProcessingDto : BatchStageProcessDto
{
    public string ProcessRecord { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class FinishedInspectionDto : BatchStageProcessDto
{
    public string InspectionResult { get; set; } = string.Empty;
    public bool InspectionPassed { get; set; }
    public string? InspectionReportUrl { get; set; }
}

public class OutboundReviewDto : BatchStageProcessDto
{
    public int WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public string? TransportDestination { get; set; }
}

public class ChemicalBatchQueryDto : PagedRequest
{
    public string? BatchNo { get; set; }
    public int? ChemicalId { get; set; }
    public int? EnterpriseId { get; set; }
    public int? WarehouseId { get; set; }
    public int? Status { get; set; }
    public DateRangeFilter? ProductionDateRange { get; set; }
    public DateRangeFilter? ExpiryDateRange { get; set; }
}

public class BatchLifeCycleDto
{
    public int BatchId { get; set; }
    public string BatchNo { get; set; } = string.Empty;
    public string ChemicalName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public List<ProcessRecordDto> ProcessRecords { get; set; } = new List<ProcessRecordDto>();
    public int CurrentStage { get; set; }
    public string CurrentStageName { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
}

public class ProcessRecordDto
{
    public int Id { get; set; }
    public int Stage { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public string? CertificateNo { get; set; }
    public string? CertificateType { get; set; }
    public bool CertificateValidated { get; set; }
    public string? ValidationResult { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; }
}
