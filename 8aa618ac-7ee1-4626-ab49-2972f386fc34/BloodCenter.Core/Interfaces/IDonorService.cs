using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IDonorService
{
    Task<DonorDto> RegisterDonorAsync(CreateDonorDto donorDto, CancellationToken cancellationToken = default);
    Task<DonorDto> UpdateDonorAsync(Guid id, UpdateDonorDto donorDto, CancellationToken cancellationToken = default);
    Task<DonorDto?> GetDonorByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DonorDto?> GetDonorByNumberAsync(string donorNumber, CancellationToken cancellationToken = default);
    Task<PagedResult<DonorDto>> SearchDonorsAsync(SearchDonorQuery query, CancellationToken cancellationToken = default);
    Task<EligibilityCheckResult> CheckEligibilityAsync(Guid donorId, MedicalHistoryDto medicalHistory, CancellationToken cancellationToken = default);
    Task<DonorDto> UpdateDonorStatusAsync(Guid id, DonorStatus status, DeferralReason? reason, DateTime? deferralUntil, CancellationToken cancellationToken = default);
    Task<DateTime> CalculateNextEligibleDateAsync(Guid donorId, CancellationToken cancellationToken = default);
    Task<IEnumerable<DonorDto>> GetDonorsForRecallAsync(int daysBefore, CancellationToken cancellationToken = default);
    Task<IEnumerable<DonationRecordDto>> GetDonationHistoryAsync(Guid donorId, CancellationToken cancellationToken = default);
    Task DeleteDonorAsync(Guid id, CancellationToken cancellationToken = default);
}

public record CreateDonorDto(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string Gender,
    string IdCardNumber,
    string PhoneNumber,
    string? Email,
    AddressDto? Address,
    string? Occupation,
    bool IsVolunteer
);

public record UpdateDonorDto(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string Gender,
    string PhoneNumber,
    string? Email,
    AddressDto? Address,
    string? Occupation
);

public record AddressDto(string Street, string City, string Province, string PostalCode);

public record MedicalHistoryDto(
    bool HadRecentSurgery,
    DateTime? SurgeryDate,
    bool HadBloodTransfusion,
    DateTime? TransfusionDate,
    bool HasHepatitis,
    bool HasHIV,
    bool HasSyphilis,
    bool HasMalaria,
    bool HasHeartDisease,
    bool HasHighBloodPressure,
    bool HasDiabetes,
    bool HasCancer,
    bool HadVaccination,
    DateTime? VaccinationDate,
    string? VaccinationType,
    bool HadTattoo,
    DateTime? TattooDate,
    bool HadDentalWork,
    DateTime? DentalWorkDate,
    bool TraveledToMalariaArea,
    DateTime? TravelDate,
    bool IsPregnant,
    bool IsBreastfeeding,
    DateTime? LastMenstrualDate,
    bool HasFever,
    bool TakingMedication,
    string? MedicationDetails,
    bool HadAlcohol,
    bool HadTobacco,
    bool HadDrugs,
    string? AdditionalNotes
);

public record EligibilityCheckResult(
    bool IsEligible,
    DonorStatus Status,
    DeferralReason? DeferralReason,
    int? DeferralDays,
    DateTime? NextEligibleDate,
    IEnumerable<string> DeferralReasons
);

public record SearchDonorQuery(
    string? Name,
    string? DonorNumber,
    string? PhoneNumber,
    string? IdCardNumber,
    DonorStatus? Status,
    int PageNumber = 1,
    int PageSize = 20
);

public record DonorDto(
    Guid Id,
    string DonorNumber,
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string Gender,
    string IdCardNumber,
    string PhoneNumber,
    string? Email,
    AddressDto? Address,
    string BloodGroupDisplay,
    BloodType? BloodType,
    RhFactor? RhFactor,
    DonorStatus Status,
    DeferralReason? DeferralReason,
    DateTime? DeferralUntil,
    DateTime? LastDonationDate,
    DateTime? NextEligibleDate,
    int TotalDonations,
    decimal TotalVolumeDonated,
    bool IsVolunteer,
    string? Occupation,
    DateTime CreatedAt
);

public record DonationRecordDto(
    Guid Id,
    string DonationNumber,
    DateTime DonationDate,
    int Volume,
    string BloodGroupDisplay,
    DonationStatus Status,
    string CollectionSiteName,
    string NurseName,
    DateTime CreatedAt
);

public record PagedResult<T>(IEnumerable<T> Items, int TotalCount, int PageNumber, int PageSize);
