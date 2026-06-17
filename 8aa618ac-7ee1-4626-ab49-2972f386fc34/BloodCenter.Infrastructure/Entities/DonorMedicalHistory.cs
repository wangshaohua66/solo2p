namespace BloodCenter.Infrastructure.Entities;

public class DonorMedicalHistory : BaseEntity
{
    public Guid DonorId { get; set; }
    public DateTime QuestionnaireDate { get; set; }
    public bool HadRecentSurgery { get; set; }
    public DateTime? SurgeryDate { get; set; }
    public bool HadBloodTransfusion { get; set; }
    public DateTime? TransfusionDate { get; set; }
    public bool HasHepatitis { get; set; }
    public bool HasHIV { get; set; }
    public bool HasSyphilis { get; set; }
    public bool HasMalaria { get; set; }
    public bool HasHeartDisease { get; set; }
    public bool HasHighBloodPressure { get; set; }
    public bool HasDiabetes { get; set; }
    public bool HasCancer { get; set; }
    public bool HadVaccination { get; set; }
    public DateTime? VaccinationDate { get; set; }
    public string? VaccinationType { get; set; }
    public bool HadTattoo { get; set; }
    public DateTime? TattooDate { get; set; }
    public bool HadDentalWork { get; set; }
    public DateTime? DentalWorkDate { get; set; }
    public bool TraveledToMalariaArea { get; set; }
    public DateTime? TravelDate { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsBreastfeeding { get; set; }
    public DateTime? LastMenstrualDate { get; set; }
    public bool HasFever { get; set; }
    public bool TakingMedication { get; set; }
    public string? MedicationDetails { get; set; }
    public bool HadAlcohol { get; set; }
    public bool HadTobacco { get; set; }
    public bool HadDrugs { get; set; }
    public string? AdditionalNotes { get; set; }
    public bool EligibilityResult { get; set; }
    public string? DeferralReason { get; set; }
    public int? DeferralDays { get; set; }

    public Donor? Donor { get; set; }
}
