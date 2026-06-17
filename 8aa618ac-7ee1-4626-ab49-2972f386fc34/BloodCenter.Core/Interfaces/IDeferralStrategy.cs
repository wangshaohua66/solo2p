using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IDeferralStrategy
{
    Task<DeferralResult> EvaluateInitialScreeningAsync(
        double hemoglobin,
        double alt,
        TestResult hbsAg,
        CancellationToken cancellationToken = default);

    Task<DeferralResult> EvaluateMedicalHistoryAsync(
        MedicalHistoryFlags history,
        DateTime? donorLastDonationDate,
        DateTime donorDateOfBirth,
        CancellationToken cancellationToken = default);

    Task<DeferralConfiguration> GetConfigurationAsync(CancellationToken cancellationToken = default);
    Task UpdateConfigurationAsync(DeferralConfiguration configuration, CancellationToken cancellationToken = default);
}

public record DeferralResult(
    bool IsEligible,
    DeferralReason? PrimaryReason,
    int? DeferralDays,
    IEnumerable<string> DeferralReasons);

public record MedicalHistoryFlags(
    bool HadRecentSurgery,
    DateTime? SurgeryDate,
    bool HasHepatitis,
    bool HasHIV,
    bool HasSyphilis,
    bool HasMalaria,
    bool HadBloodTransfusion,
    DateTime? TransfusionDate,
    bool IsPregnant,
    bool IsBreastfeeding,
    bool HadTattoo,
    DateTime? TattooDate,
    bool HadDentalWork,
    DateTime? DentalWorkDate,
    bool TraveledToMalariaArea,
    DateTime? TravelDate,
    bool HadVaccination,
    DateTime? VaccinationDate,
    bool HasHighBloodPressure,
    bool HasFever,
    bool HasHeartDisease,
    bool HasDiabetes,
    bool HasCancer,
    bool HadDrugs);

public record DeferralConfiguration(
    double MinimumHemoglobin,
    double MaximumALT,
    int DaysAfterSurgery,
    int DaysAfterTransfusion,
    int DaysAfterTattoo,
    int DaysAfterDentalWork,
    int DaysAfterVaccination,
    int DaysAfterMalariaTravel,
    int DaysPostPregnancy,
    int DaysPostBreastfeeding,
    int DaysAfterFever,
    int DaysBetweenDonations,
    int MinimumAge,
    int MaximumAge);
