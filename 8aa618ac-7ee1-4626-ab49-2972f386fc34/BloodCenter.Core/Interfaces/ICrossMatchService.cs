using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface ICrossMatchService
{
    Task<BloodRequestDto> CreateBloodRequestAsync(CreateBloodRequestDto requestDto, CancellationToken cancellationToken = default);
    Task<BloodRequestDto?> GetRequestByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<BloodRequestDto?> GetRequestByNumberAsync(string requestNumber, CancellationToken cancellationToken = default);
    Task<PagedResult<BloodRequestDto>> GetRequestsAsync(SearchBloodRequestQuery query, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodRequestDto>> GetRequestsByHospitalAsync(Guid hospitalId, CancellationToken cancellationToken = default);
    Task<IEnumerable<CrossMatchResultDto>> PerformCrossMatchAsync(Guid requestId, Guid technicianId, CancellationToken cancellationToken = default);
    Task<CrossMatchResultDto> RecordCrossMatchResultAsync(RecordCrossMatchDto matchDto, CancellationToken cancellationToken = default);
    Task<IssueResultDto> IssueProductsAsync(Guid requestId, Guid operatorId, CancellationToken cancellationToken = default);
    Task<BloodRequestDto> UpdateRequestStatusAsync(Guid requestId, RequestStatus status, string? notes, CancellationToken cancellationToken = default);
    Task<IEnumerable<CompatibleProductDto>> FindCompatibleProductsAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<RequestStatsDto> GetRequestStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task CancelRequestAsync(Guid requestId, string reason, CancellationToken cancellationToken = default);
}

public record CreateBloodRequestDto(
    Guid HospitalId,
    string PatientName,
    string PatientId,
    int? PatientAge,
    string? PatientGender,
    string? Diagnosis,
    BloodType PatientBloodType,
    RhFactor PatientRhFactor,
    BloodProductType ProductType,
    int QuantityRequested,
    UrgencyLevel Urgency,
    DateTime RequiredDate,
    string Ward,
    string? BedNumber,
    string RequestedBy,
    string? RequestDoctor,
    string? TransfusionHistory,
    string? PregnancyHistory,
    string? Notes
);

public record RecordCrossMatchDto(
    Guid BloodRequestId,
    Guid BloodProductId,
    Guid TechnicianId,
    DateTime TestTime,
    CrossMatchResult MajorSideResult,
    CrossMatchResult MinorSideResult,
    string? TestMethod,
    string? ReagentUsed,
    string? Notes
);

public record SearchBloodRequestQuery(
    Guid? HospitalId,
    string? PatientId,
    BloodProductType? ProductType,
    UrgencyLevel? Urgency,
    RequestStatus? Status,
    DateTime? StartDate,
    DateTime? EndDate,
    int PageNumber = 1,
    int PageSize = 20
);

public record BloodRequestDto(
    Guid Id,
    string RequestNumber,
    Guid HospitalId,
    string HospitalName,
    string PatientName,
    string PatientId,
    int? PatientAge,
    string? PatientGender,
    string? Diagnosis,
    string PatientBloodGroupDisplay,
    BloodProductType ProductType,
    int QuantityRequested,
    int QuantityIssued,
    UrgencyLevel Urgency,
    DateTime RequiredDate,
    string Ward,
    string? BedNumber,
    string RequestedBy,
    string? RequestDoctor,
    RequestStatus Status,
    DateTime? FulfilledAt,
    string? Notes,
    DateTime CreatedAt,
    IEnumerable<CrossMatchResultDto> CrossMatches
);

public record CrossMatchResultDto(
    Guid Id,
    Guid BloodRequestId,
    Guid BloodProductId,
    string ProductCode,
    Guid TechnicianId,
    string TechnicianName,
    DateTime TestTime,
    CrossMatchResult MajorSideResult,
    CrossMatchResult MinorSideResult,
    CrossMatchResult OverallResult,
    string? TestMethod,
    bool IsReserved,
    DateTime? ReservedUntil
);

public record CompatibleProductDto(
    Guid ProductId,
    string ProductCode,
    string BloodGroupDisplay,
    BloodProductType ProductType,
    int Volume,
    DateTime ExpiryDate,
    int DaysUntilExpiry,
    string? StorageLocation,
    bool IsEmergencyRelease
);

public record IssueResultDto(
    Guid RequestId,
    string RequestNumber,
    int UnitsIssued,
    IEnumerable<IssuedProductDto> IssuedProducts,
    DateTime IssueTime,
    string IssuedBy
);

public record IssuedProductDto(
    Guid ProductId,
    string ProductCode,
    string BloodGroupDisplay,
    BloodProductType ProductType,
    int Volume,
    DateTime ExpiryDate
);

public record RequestStatsDto(
    int TotalRequests,
    int FulfilledRequests,
    int PendingRequests,
    int CancelledRequests,
    int TotalUnitsRequested,
    int TotalUnitsIssued,
    decimal FulfillmentRate,
    TimeSpan AverageResponseTime,
    Dictionary<UrgencyLevel, int> ByUrgency,
    Dictionary<BloodProductType, int> ByProductType
);
