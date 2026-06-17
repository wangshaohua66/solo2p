namespace BloodCenter.Core.Entities;

public class DeferralOptions
{
    public double MinimumHemoglobin { get; set; } = 120.0;
    public double MaximumALT { get; set; } = 40.0;
    public int LowHemoglobinDeferralDays { get; set; } = 90;
    public int HighALTDeferralDays { get; set; } = 30;
    public bool HBsAgPermanentDeferral { get; set; } = true;
    public int DaysAfterSurgery { get; set; } = 180;
    public int DaysAfterTransfusion { get; set; } = 365;
    public int DaysAfterTattoo { get; set; } = 180;
    public int DaysAfterDentalWork { get; set; } = 7;
    public int DaysAfterVaccination { get; set; } = 28;
    public int DaysAfterMalariaTravel { get; set; } = 365;
    public int DaysPostPregnancy { get; set; } = 180;
    public int DaysPostBreastfeeding { get; set; } = 90;
    public int DaysAfterFever { get; set; } = 14;
    public int DaysBetweenDonations { get; set; } = 56;
    public int MinimumAge { get; set; } = 18;
    public int MaximumAge { get; set; } = 55;
    public bool InfectiousDiseasePermanentDeferral { get; set; } = true;
    public bool DrugUsePermanentDeferral { get; set; } = true;
}
