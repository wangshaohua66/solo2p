using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IDonationService
{
    Task<DonationDto> CreateDonationAsync(CreateDonationDto donationDto, CancellationToken cancellationToken = default);
    Task<DonationDto?> GetDonationByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DonationDto?> GetDonationByNumberAsync(string donationNumber, CancellationToken cancellationToken = default);
    Task<PagedResult<DonationDto>> GetDonationsAsync(SearchDonationQuery query, CancellationToken cancellationToken = default);
    Task<InitialScreeningDto> RecordInitialScreeningAsync(Guid donationId, CreateInitialScreeningDto screeningDto, CancellationToken cancellationToken = default);
    Task<DonationDto> UpdateDonationStatusAsync(Guid id, DonationStatus status, string? notes, CancellationToken cancellationToken = default);
    Task<IEnumerable<DonationDto>> GetDonationsByDonorAsync(Guid donorId, CancellationToken cancellationToken = default);
    Task<DonationStatsDto> GetDonationStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task DeleteDonationAsync(Guid id, CancellationToken cancellationToken = default);
}

public record CreateDonationDto(
    Guid DonorId,
    Guid CollectionSiteId,
    Guid NurseId,
    DateTime DonationDate,
    int Volume,
    BloodType BloodType,
    RhFactor RhFactor,
    string? Arm,
    string? Notes
);

public record CreateInitialScreeningDto(
    Guid TechnicianId,
    DateTime ScreeningTime,
    BloodType BloodType,
    RhFactor RhFactor,
    decimal Hemoglobin,
    decimal ALT,
    TestResult HBsAg,
    string? Notes
);

public record InitialScreeningDto(
    Guid Id,
    Guid DonationId,
    string DonationNumber,
    Guid TechnicianId,
    string TechnicianName,
    DateTime ScreeningTime,
    BloodType BloodType,
    RhFactor RhFactor,
    decimal Hemoglobin,
    decimal ALT,
    TestResult HBsAg,
    bool Passed,
    string? FailureReason,
    string? Notes
);

public record SearchDonationQuery(
    Guid? DonorId,
    Guid? CollectionSiteId,
    Guid? NurseId,
    DonationStatus? Status,
    DateTime? StartDate,
    DateTime? EndDate,
    int PageNumber = 1,
    int PageSize = 20
);

public record DonationDto(
    Guid Id,
    string DonationNumber,
    Guid DonorId,
    string DonorName,
    string DonorNumber,
    Guid CollectionSiteId,
    string CollectionSiteName,
    Guid NurseId,
    string NurseName,
    DateTime DonationDate,
    int Volume,
    string BloodGroupDisplay,
    DonationStatus Status,
    string? Arm,
    string? Reaction,
    string? Notes,
    bool InitialScreeningPassed,
    string? InitialScreeningFailureReason,
    bool AllTestsPassed,
    bool IsQuarantined,
    DateTime CreatedAt
);

public record DonationStatsDto(
    int TotalDonations,
    int SuccessfulDonations,
    int DeferredDonations,
    int TotalVolume,
    decimal AverageVolume,
    Dictionary<string, int> ByBloodType,
    Dictionary<Guid, int> BySite,
    Dictionary<string, int> ByDay
);
