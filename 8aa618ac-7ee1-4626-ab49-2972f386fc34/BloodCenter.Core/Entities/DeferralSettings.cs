namespace BloodCenter.Core.Entities;

public class DeferralSettings : BaseEntity
{
    public string Key { get; set; } = "Default";
    public double MinimumHemoglobin { get; set; }
    public double MaximumALT { get; set; }
    public int LowHemoglobinDeferralDays { get; set; }
    public int HighALTDeferralDays { get; set; }
    public bool HBsAgPermanentDeferral { get; set; }
    public int DaysAfterSurgery { get; set; }
    public int DaysAfterTransfusion { get; set; }
    public int DaysAfterTattoo { get; set; }
    public int DaysAfterDentalWork { get; set; }
    public int DaysAfterVaccination { get; set; }
    public int DaysAfterMalariaTravel { get; set; }
    public int DaysPostPregnancy { get; set; }
    public int DaysPostBreastfeeding { get; set; }
    public int DaysAfterFever { get; set; }
    public int DaysBetweenDonations { get; set; }
    public int MinimumAge { get; set; }
    public int MaximumAge { get; set; }
    public bool InfectiousDiseasePermanentDeferral { get; set; }
    public bool DrugUsePermanentDeferral { get; set; }
}
