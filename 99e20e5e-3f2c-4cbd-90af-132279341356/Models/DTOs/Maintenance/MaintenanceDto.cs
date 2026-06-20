using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Maintenance;

public class MaintenanceCompanyDto
{
    public long Id { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string? UnifiedSocialCreditCode { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? LegalPerson { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? QualificationCert { get; set; }
    public DateTime? QualificationExpiryDate { get; set; }
    public int Rating { get; set; }
    public bool IsActive { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceCompanyCreateDto
{
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string? UnifiedSocialCreditCode { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? LegalPerson { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? QualificationCert { get; set; }
    public DateTime? QualificationExpiryDate { get; set; }
    public string? Description { get; set; }
}

public class MaintenanceContractDto
{
    public long Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public long MaintenanceCompanyId { get; set; }
    public string? MaintenanceCompanyName { get; set; }
    public MaintenanceStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string? Scope { get; set; }
    public string? ServiceItems { get; set; }
    public decimal? ContractAmount { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public int ReminderDaysBeforeExpiry { get; set; }
    public bool ReminderSent { get; set; }
    public string? Description { get; set; }
    public string? AttachmentUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceContractCreateDto
{
    public string ContractNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public long MaintenanceCompanyId { get; set; }
    public string ContractName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string? Scope { get; set; }
    public string? ServiceItems { get; set; }
    public decimal? ContractAmount { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public int ReminderDaysBeforeExpiry { get; set; } = 30;
    public string? Description { get; set; }
    public string? AttachmentUrl { get; set; }
}

public class MaintenanceContractQueryDto : PagedQuery
{
    public MaintenanceStatus? Status { get; set; }
    public long? FireUnitId { get; set; }
    public long? MaintenanceCompanyId { get; set; }
    public string? DistrictCode { get; set; }
    public bool? ExpiringSoon { get; set; }
}

public class MaintenanceRecordDto
{
    public long Id { get; set; }
    public long ContractId { get; set; }
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public long? DeviceId { get; set; }
    public string? DeviceCode { get; set; }
    public string MaintenanceType { get; set; } = string.Empty;
    public DateTime PlanDate { get; set; }
    public DateTime? ActualDate { get; set; }
    public string? Content { get; set; }
    public string? Result { get; set; }
    public bool IsQualified { get; set; }
    public string? ProblemFound { get; set; }
    public string? Solution { get; set; }
    public string? Operator { get; set; }
    public string? OperatorPhone { get; set; }
    public string? Photos { get; set; }
    public string? Remark { get; set; }
    public int QualityScore { get; set; }
    public string? QualityComment { get; set; }
    public DateTime? EvaluatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MaintenanceRecordCreateDto
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
}

public class MaintenanceEvaluateDto
{
    public long RecordId { get; set; }
    public int QualityScore { get; set; }
    public string? QualityComment { get; set; }
    public long EvaluatorId { get; set; }
}
