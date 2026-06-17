using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IScrapTraceService
{
    Task<ScrapRecordDto> CreateScrapRecordAsync(CreateScrapRecordDto scrapDto, CancellationToken cancellationToken = default);
    Task<ScrapRecordDto> ApproveScrapRecordAsync(Guid scrapId, Guid approvedById, string? approvalNotes, CancellationToken cancellationToken = default);
    Task<ScrapRecordDto?> GetScrapRecordByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PagedResult<ScrapRecordDto>> GetScrapRecordsAsync(SearchScrapQuery query, CancellationToken cancellationToken = default);
    Task<IEnumerable<ScrapRecordDto>> GetScrapsByProductAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<int> ProcessAutoScrapForExpiredProductsAsync(CancellationToken cancellationToken = default);
    Task<TraceResultDto> TraceProductForwardAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<TraceResultDto> TraceProductBackwardAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<TraceResultDto> TraceByDonorAsync(Guid donorId, CancellationToken cancellationToken = default);
    Task<TraceResultDto> TraceByPatientAsync(string patientId, CancellationToken cancellationToken = default);
    Task<ScrapStatsDto> GetScrapStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<IEnumerable<ProductTraceDto>> GetFullTraceChainAsync(Guid productId, CancellationToken cancellationToken = default);
    Task DeleteScrapRecordAsync(Guid id, CancellationToken cancellationToken = default);
}

public record CreateScrapRecordDto(
    Guid BloodProductId,
    ScrapReason Reason,
    string? DetailedReason,
    DateTime ScrapDate,
    Guid OperatorId,
    string? DisposalMethod,
    string? Notes
);

public record SearchScrapQuery(
    Guid? ProductId,
    ScrapReason? Reason,
    Guid? OperatorId,
    DateTime? StartDate,
    DateTime? EndDate,
    bool? ApprovedOnly,
    int PageNumber = 1,
    int PageSize = 20
);

public record ScrapRecordDto(
    Guid Id,
    Guid BloodProductId,
    string ProductCode,
    ScrapReason Reason,
    string? DetailedReason,
    DateTime ScrapDate,
    Guid OperatorId,
    string OperatorName,
    Guid? ApprovedById,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? DisposalMethod,
    string? Notes,
    bool IsApproved
);

public record TraceResultDto(
    Guid TraceStartId,
    string TraceType,
    IEnumerable<TraceNodeDto> TraceChain,
    DateTime TraceTime
);

public record TraceNodeDto(
    string NodeType,
    string NodeId,
    string NodeDescription,
    DateTime Timestamp,
    string? Operator,
    string Status,
    IEnumerable<TraceLinkDto> Links
);

public record TraceLinkDto(
    string RelationType,
    string TargetNodeId,
    string TargetNodeType
);

public record ProductTraceDto(
    Guid ProductId,
    string ProductCode,
    BloodProductType ProductType,
    string BloodGroupDisplay,
    DateTime ProductionDate,
    DateTime? IssueDate,
    string? RecipientInfo,
    IEnumerable<TraceEventDto> Events
);

public record TraceEventDto(
    DateTime EventTime,
    string EventType,
    string Description,
    string? Operator,
    string Location
);

public record ScrapStatsDto(
    int TotalScrappedUnits,
    int ExpiredUnits,
    int TestPositiveUnits,
    int QualityUnits,
    decimal ScrapRate,
    Dictionary<ScrapReason, int> ByReason,
    Dictionary<BloodProductType, int> ByProductType,
    Dictionary<BloodType, int> ByBloodType,
    decimal FinancialImpact
);
