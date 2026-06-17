using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.Options;

namespace BloodCenter.Core.Services;

public class DeferralStrategyService : IDeferralStrategy
{
    private DeferralOptions _options;

    public DeferralStrategyService(IOptions<DeferralOptions> options)
    {
        _options = options.Value;
    }

    public Task<DeferralResult> EvaluateInitialScreeningAsync(
        double hemoglobin,
        double alt,
        TestResult hbsAg,
        CancellationToken cancellationToken = default)
    {
        var deferralReasons = new List<string>();
        DeferralReason? primaryReason = null;
        int? deferralDays = null;
        bool isPermanent = false;

        if (hemoglobin < _options.MinimumHemoglobin)
        {
            deferralReasons.Add($"Hemoglobin level {hemoglobin} is below minimum {_options.MinimumHemoglobin}");
            primaryReason = DeferralReason.LowHemoglobin;
            deferralDays = _options.LowHemoglobinDeferralDays;
        }

        if (alt > _options.MaximumALT)
        {
            deferralReasons.Add($"ALT level {alt} exceeds maximum {_options.MaximumALT}");
            primaryReason ??= DeferralReason.HighALT;
            deferralDays = Math.Max(deferralDays ?? 0, _options.HighALTDeferralDays);
        }

        if (hbsAg == TestResult.Positive || hbsAg == TestResult.Reactive)
        {
            deferralReasons.Add("HBsAg test result is positive/reactive");
            primaryReason ??= DeferralReason.InfectiousDiseaseHistory;
            if (_options.HBsAgPermanentDeferral)
            {
                isPermanent = true;
            }
        }

        bool isEligible = deferralReasons.Count == 0;
        int? finalDeferralDays = isPermanent ? -1 : (isEligible ? null : deferralDays);

        return Task.FromResult(new DeferralResult(
            isEligible,
            primaryReason,
            finalDeferralDays,
            deferralReasons));
    }

    public Task<DeferralResult> EvaluateMedicalHistoryAsync(
        MedicalHistoryFlags history,
        DateTime? donorLastDonationDate,
        DateTime donorDateOfBirth,
        CancellationToken cancellationToken = default)
    {
        var deferralReasons = new List<string>();
        DeferralReason? primaryReason = null;
        int maxDeferralDays = 0;
        bool isPermanent = false;
        var now = DateTime.UtcNow;

        var age = now.Year - donorDateOfBirth.Year;
        if (donorDateOfBirth > now.AddYears(-age)) age--;

        if (age < _options.MinimumAge || age > _options.MaximumAge)
        {
            deferralReasons.Add($"Age {age} is outside eligible range ({_options.MinimumAge}-{_options.MaximumAge} years)");
            primaryReason = DeferralReason.Other;
        }

        if (donorLastDonationDate.HasValue)
        {
            var daysSinceLastDonation = (now - donorLastDonationDate.Value).TotalDays;
            if (daysSinceLastDonation < _options.DaysBetweenDonations)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysBetweenDonations - daysSinceLastDonation);
                deferralReasons.Add($"Less than {_options.DaysBetweenDonations} days since last donation ({(int)daysSinceLastDonation} days ago)");
                primaryReason ??= DeferralReason.Other;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.HadRecentSurgery && history.SurgeryDate.HasValue)
        {
            var daysSinceSurgery = (now - history.SurgeryDate.Value).TotalDays;
            if (daysSinceSurgery < _options.DaysAfterSurgery)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterSurgery - daysSinceSurgery);
                deferralReasons.Add($"Recent surgery within {_options.DaysAfterSurgery} days ({(int)daysSinceSurgery} days ago)");
                primaryReason ??= DeferralReason.RecentSurgery;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.HadBloodTransfusion && history.TransfusionDate.HasValue)
        {
            var daysSinceTransfusion = (now - history.TransfusionDate.Value).TotalDays;
            if (daysSinceTransfusion < _options.DaysAfterTransfusion)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterTransfusion - daysSinceTransfusion);
                deferralReasons.Add($"Recent blood transfusion within {_options.DaysAfterTransfusion} days ({(int)daysSinceTransfusion} days ago)");
                primaryReason ??= DeferralReason.RecentBloodTransfusion;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.HadTattoo && history.TattooDate.HasValue)
        {
            var daysSinceTattoo = (now - history.TattooDate.Value).TotalDays;
            if (daysSinceTattoo < _options.DaysAfterTattoo)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterTattoo - daysSinceTattoo);
                deferralReasons.Add($"Recent tattoo within {_options.DaysAfterTattoo} days ({(int)daysSinceTattoo} days ago)");
                primaryReason ??= DeferralReason.RecentTattoo;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.HadDentalWork && history.DentalWorkDate.HasValue)
        {
            var daysSinceDentalWork = (now - history.DentalWorkDate.Value).TotalDays;
            if (daysSinceDentalWork < _options.DaysAfterDentalWork)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterDentalWork - daysSinceDentalWork);
                deferralReasons.Add($"Recent dental work within {_options.DaysAfterDentalWork} days ({(int)daysSinceDentalWork} days ago)");
                primaryReason ??= DeferralReason.RecentDentalWork;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.HadVaccination && history.VaccinationDate.HasValue)
        {
            var daysSinceVaccination = (now - history.VaccinationDate.Value).TotalDays;
            if (daysSinceVaccination < _options.DaysAfterVaccination)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterVaccination - daysSinceVaccination);
                deferralReasons.Add($"Recent vaccination within {_options.DaysAfterVaccination} days ({(int)daysSinceVaccination} days ago)");
                primaryReason ??= DeferralReason.RecentVaccination;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.TraveledToMalariaArea && history.TravelDate.HasValue)
        {
            var daysSinceTravel = (now - history.TravelDate.Value).TotalDays;
            if (daysSinceTravel < _options.DaysAfterMalariaTravel)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterMalariaTravel - daysSinceTravel);
                deferralReasons.Add($"Travel to malaria area within {_options.DaysAfterMalariaTravel} days ({(int)daysSinceTravel} days ago)");
                primaryReason ??= DeferralReason.TravelToMalariaArea;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
            }
        }

        if (history.IsPregnant)
        {
            deferralReasons.Add("Currently pregnant");
            primaryReason ??= DeferralReason.Pregnancy;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysPostPregnancy);
        }

        if (history.IsBreastfeeding)
        {
            deferralReasons.Add("Currently breastfeeding");
            primaryReason ??= DeferralReason.Breastfeeding;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysPostBreastfeeding);
        }

        if (history.HasFever)
        {
            deferralReasons.Add("Current fever");
            primaryReason ??= DeferralReason.Fever;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysAfterFever);
        }

        if (history.HasHighBloodPressure)
        {
            deferralReasons.Add("High blood pressure");
            primaryReason ??= DeferralReason.HighBloodPressure;
        }

        if (history.HasHepatitis || history.HasHIV || history.HasSyphilis || history.HasMalaria)
        {
            deferralReasons.Add("History of infectious disease: hepatitis, HIV, syphilis, or malaria");
            primaryReason ??= DeferralReason.InfectiousDiseaseHistory;
            if (_options.InfectiousDiseasePermanentDeferral)
            {
                isPermanent = true;
            }
        }

        if (history.HadDrugs)
        {
            deferralReasons.Add("History of drug use");
            primaryReason ??= DeferralReason.Other;
            if (_options.DrugUsePermanentDeferral)
            {
                isPermanent = true;
            }
        }

        bool isEligible = deferralReasons.Count == 0;
        int? finalDeferralDays;

        if (isEligible)
        {
            finalDeferralDays = null;
        }
        else if (isPermanent)
        {
            finalDeferralDays = -1;
        }
        else
        {
            finalDeferralDays = maxDeferralDays > 0 ? maxDeferralDays : null;
        }

        return Task.FromResult(new DeferralResult(
            isEligible,
            primaryReason,
            finalDeferralDays,
            deferralReasons));
    }

    public Task<DeferralConfiguration> GetConfigurationAsync(CancellationToken cancellationToken = default)
    {
        var config = new DeferralConfiguration(
            _options.MinimumHemoglobin,
            _options.MaximumALT,
            _options.DaysAfterSurgery,
            _options.DaysAfterTransfusion,
            _options.DaysAfterTattoo,
            _options.DaysAfterDentalWork,
            _options.DaysAfterVaccination,
            _options.DaysAfterMalariaTravel,
            _options.DaysPostPregnancy,
            _options.DaysPostBreastfeeding,
            _options.DaysAfterFever,
            _options.DaysBetweenDonations,
            _options.MinimumAge,
            _options.MaximumAge);

        return Task.FromResult(config);
    }

    public Task UpdateConfigurationAsync(DeferralConfiguration configuration, CancellationToken cancellationToken = default)
    {
        _options.MinimumHemoglobin = configuration.MinimumHemoglobin;
        _options.MaximumALT = configuration.MaximumALT;
        _options.DaysAfterSurgery = configuration.DaysAfterSurgery;
        _options.DaysAfterTransfusion = configuration.DaysAfterTransfusion;
        _options.DaysAfterTattoo = configuration.DaysAfterTattoo;
        _options.DaysAfterDentalWork = configuration.DaysAfterDentalWork;
        _options.DaysAfterVaccination = configuration.DaysAfterVaccination;
        _options.DaysAfterMalariaTravel = configuration.DaysAfterMalariaTravel;
        _options.DaysPostPregnancy = configuration.DaysPostPregnancy;
        _options.DaysPostBreastfeeding = configuration.DaysPostBreastfeeding;
        _options.DaysAfterFever = configuration.DaysAfterFever;
        _options.DaysBetweenDonations = configuration.DaysBetweenDonations;
        _options.MinimumAge = configuration.MinimumAge;
        _options.MaximumAge = configuration.MaximumAge;

        return Task.CompletedTask;
    }
}
