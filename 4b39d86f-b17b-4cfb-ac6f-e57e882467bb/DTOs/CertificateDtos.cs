namespace HazChemSupervision.DTOs;

public class CertificateDto
{
    public int Id { get; set; }
    public string CertificateNo { get; set; } = string.Empty;
    public int Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public string HolderName { get; set; } = string.Empty;
    public string? HolderIdCard { get; set; }
    public int? EnterpriseId { get; set; }
    public string? EnterpriseName { get; set; }
    public int? UserId { get; set; }
    public string IssuingAuthority { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? Scope { get; set; }
    public string? AttachmentUrl { get; set; }
    public bool Verified { get; set; }
    public DateTime? LastVerifiedTime { get; set; }
    public string? VerificationResult { get; set; }
    public int DaysToExpire => (ExpiryDate - DateTime.UtcNow).Days;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CertificateCreateDto
{
    public string CertificateNo { get; set; } = string.Empty;
    public int Type { get; set; }
    public string HolderName { get; set; } = string.Empty;
    public string? HolderIdCard { get; set; }
    public int? EnterpriseId { get; set; }
    public int? UserId { get; set; }
    public string IssuingAuthority { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public string? Scope { get; set; }
    public string? AttachmentUrl { get; set; }
}

public class CertificateVerifyDto
{
    public string CertificateNo { get; set; } = string.Empty;
    public int Type { get; set; }
    public string HolderName { get; set; } = string.Empty;
    public string? HolderIdCard { get; set; }
}

public class CertificateVerificationResultDto
{
    public bool IsValid { get; set; }
    public string? Message { get; set; }
    public string? CertificateNo { get; set; }
    public string? HolderName { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? Status { get; set; }
    public DateTime VerifiedAt { get; set; }
}

public class CertificateQueryDto : PagedRequest
{
    public string? CertificateNo { get; set; }
    public int? Type { get; set; }
    public string? HolderName { get; set; }
    public int? EnterpriseId { get; set; }
    public int? UserId { get; set; }
    public int? Status { get; set; }
    public bool? Verified { get; set; }
    public bool? IsExpiring { get; set; }
    public DateRangeFilter? ExpiryDateRange { get; set; }
}

public class AlertDto
{
    public int Id { get; set; }
    public string AlertNo { get; set; } = string.Empty;
    public int Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public int Level { get; set; }
    public string LevelName { get; set; } = string.Empty;
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public int? EnterpriseId { get; set; }
    public string? EnterpriseName { get; set; }
    public int? ChemicalId { get; set; }
    public string? ChemicalName { get; set; }
    public int? WarehouseId { get; set; }
    public string? WarehouseName { get; set; }
    public int? ChemicalBatchId { get; set; }
    public string? BatchNo { get; set; }
    public int? TransportRecordId { get; set; }
    public string? TransportNo { get; set; }
    public int? HazardRectificationId { get; set; }
    public string? WorkOrderNo { get; set; }
    public int? CertificateId { get; set; }
    public int? EmergencyDrillId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Content { get; set; }
    public string? Suggestion { get; set; }
    public string? RecipientRole { get; set; }
    public int? RecipientUserId { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadTime { get; set; }
    public bool IsHandled { get; set; }
    public DateTime? HandleTime { get; set; }
    public string? HandleResult { get; set; }
    public int? HandlerUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AlertCreateDto
{
    public int Type { get; set; }
    public int Level { get; set; }
    public int? EnterpriseId { get; set; }
    public int? ChemicalId { get; set; }
    public int? WarehouseId { get; set; }
    public int? ChemicalBatchId { get; set; }
    public int? TransportRecordId { get; set; }
    public int? HazardRectificationId { get; set; }
    public int? CertificateId { get; set; }
    public int? EmergencyDrillId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Suggestion { get; set; }
    public string? RecipientRole { get; set; }
    public int? RecipientUserId { get; set; }
}

public class AlertHandleDto
{
    public string HandleResult { get; set; } = string.Empty;
    public int HandlerUserId { get; set; }
    public DateTime HandleTime { get; set; }
}

public class AlertQueryDto : PagedRequest
{
    public int? Type { get; set; }
    public int? Level { get; set; }
    public int? Status { get; set; }
    public int? EnterpriseId { get; set; }
    public bool? IsRead { get; set; }
    public bool? IsHandled { get; set; }
    public DateRangeFilter? CreatedDateRange { get; set; }
}

public class ComplianceReportDto
{
    public int ReportId { get; set; }
    public string ReportNo { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public int? EnterpriseId { get; set; }
    public string? EnterpriseName { get; set; }
    public DateTime GeneratedAt { get; set; }
    public int TotalBatches { get; set; }
    public int QualifiedBatches { get; set; }
    public int UnqualifiedBatches { get; set; }
    public int InTransitTransports { get; set; }
    public int CompletedTransports { get; set; }
    public int AnomalyTransports { get; set; }
    public int TotalInventory { get; set; }
    public int OverstockInventory { get; set; }
    public int LowStockInventory { get; set; }
    public int NearExpiryInventory { get; set; }
    public int TotalHazards { get; set; }
    public int ClosedHazards { get; set; }
    public int OverdueHazards { get; set; }
    public int PlannedDrills { get; set; }
    public int CompletedDrills { get; set; }
    public int OverdueDrills { get; set; }
    public int ValidCertificates { get; set; }
    public int ExpiringCertificates { get; set; }
    public int ExpiredCertificates { get; set; }
    public decimal ComplianceScore { get; set; }
    public string? ComplianceLevel { get; set; }
    public List<string>? Issues { get; set; }
    public List<string>? Recommendations { get; set; }
}

public class ReportQueryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public int? EnterpriseId { get; set; }
}
