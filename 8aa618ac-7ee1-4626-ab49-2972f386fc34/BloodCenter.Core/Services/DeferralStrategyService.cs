using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using Microsoft.Extensions.Options;

namespace BloodCenter.Core.Services;

public class DeferralStrategyService : IDeferralStrategy
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOptions<DeferralOptions> _optionsSnapshot;
    private DeferralOptions _options;
    private bool _isLoaded;
    private readonly object _lock = new();

    public DeferralStrategyService(IUnitOfWork unitOfWork, IOptions<DeferralOptions> optionsSnapshot)
    {
        _unitOfWork = unitOfWork;
        _optionsSnapshot = optionsSnapshot;
        _options = optionsSnapshot.Value;
    }

    private async Task EnsureLoadedAsync(CancellationToken cancellationToken = default)
    {
        if (_isLoaded)
            return;

        lock (_lock)
        {
            if (_isLoaded)
                return;
        }

        var settings = await _unitOfWork.DeferralSettings.FirstOrDefaultAsync(
            s => s.Key == "Default",
            cancellationToken);

        if (settings != null)
        {
            _options = MapToOptions(settings);
        }
        else
        {
            var defaultSettings = MapFromOptions(_optionsSnapshot.Value);
            await _unitOfWork.DeferralSettings.AddAsync(defaultSettings, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            _options = _optionsSnapshot.Value;
        }

        lock (_lock)
        {
            _isLoaded = true;
        }
    }

    public async Task<DeferralResult> EvaluateInitialScreeningAsync(
        double hemoglobin,
        double alt,
        TestResult hbsAg,
        CancellationToken cancellationToken = default)
    {
        await EnsureLoadedAsync(cancellationToken);

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

        return new DeferralResult(
            isEligible,
            primaryReason,
            finalDeferralDays,
            deferralReasons);
    }

    public async Task<DeferralResult> EvaluateMedicalHistoryAsync(
        MedicalHistoryFlags history,
        DateTime? donorLastDonationDate,
        DateTime donorDateOfBirth,
        CancellationToken cancellationToken = default)
    {
        await EnsureLoadedAsync(cancellationToken);

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

        return new DeferralResult(
            isEligible,
            primaryReason,
            finalDeferralDays,
            deferralReasons);
    }

    public async Task<DeferralConfiguration> GetConfigurationAsync(CancellationToken cancellationToken = default)
    {
        await EnsureLoadedAsync(cancellationToken);

        return new DeferralConfiguration(
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
    }

    public async Task UpdateConfigurationAsync(DeferralConfiguration configuration, CancellationToken cancellationToken = default)
    {
        await EnsureLoadedAsync(cancellationToken);

        var settings = await _unitOfWork.DeferralSettings.FirstOrDefaultAsync(
            s => s.Key == "Default",
            cancellationToken);

        if (settings == null)
        {
            settings = new DeferralSettings { Key = "Default" };
            MapFromConfiguration(configuration, settings);
            await _unitOfWork.DeferralSettings.AddAsync(settings, cancellationToken);
        }
        else
        {
            MapFromConfiguration(configuration, settings);
            _unitOfWork.DeferralSettings.Update(settings);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _options = MapToOptions(settings);
    }

    private static DeferralOptions MapToOptions(DeferralSettings settings)
    {
        return new DeferralOptions
        {
            MinimumHemoglobin = settings.MinimumHemoglobin,
            MaximumALT = settings.MaximumALT,
            LowHemoglobinDeferralDays = settings.LowHemoglobinDeferralDays,
            HighALTDeferralDays = settings.HighALTDeferralDays,
            HBsAgPermanentDeferral = settings.HBsAgPermanentDeferral,
            DaysAfterSurgery = settings.DaysAfterSurgery,
            DaysAfterTransfusion = settings.DaysAfterTransfusion,
            DaysAfterTattoo = settings.DaysAfterTattoo,
            DaysAfterDentalWork = settings.DaysAfterDentalWork,
            DaysAfterVaccination = settings.DaysAfterVaccination,
            DaysAfterMalariaTravel = settings.DaysAfterMalariaTravel,
            DaysPostPregnancy = settings.DaysPostPregnancy,
            DaysPostBreastfeeding = settings.DaysPostBreastfeeding,
            DaysAfterFever = settings.DaysAfterFever,
            DaysBetweenDonations = settings.DaysBetweenDonations,
            MinimumAge = settings.MinimumAge,
            MaximumAge = settings.MaximumAge,
            InfectiousDiseasePermanentDeferral = settings.InfectiousDiseasePermanentDeferral,
            DrugUsePermanentDeferral = settings.DrugUsePermanentDeferral
        };
    }

    private static DeferralSettings MapFromOptions(DeferralOptions options)
    {
        return new DeferralSettings
        {
            Key = "Default",
            MinimumHemoglobin = options.MinimumHemoglobin,
            MaximumALT = options.MaximumALT,
            LowHemoglobinDeferralDays = options.LowHemoglobinDeferralDays,
            HighALTDeferralDays = options.HighALTDeferralDays,
            HBsAgPermanentDeferral = options.HBsAgPermanentDeferral,
            DaysAfterSurgery = options.DaysAfterSurgery,
            DaysAfterTransfusion = options.DaysAfterTransfusion,
            DaysAfterTattoo = options.DaysAfterTattoo,
            DaysAfterDentalWork = options.DaysAfterDentalWork,
            DaysAfterVaccination = options.DaysAfterVaccination,
            DaysAfterMalariaTravel = options.DaysAfterMalariaTravel,
            DaysPostPregnancy = options.DaysPostPregnancy,
            DaysPostBreastfeeding = options.DaysPostBreastfeeding,
            DaysAfterFever = options.DaysAfterFever,
            DaysBetweenDonations = options.DaysBetweenDonations,
            MinimumAge = options.MinimumAge,
            MaximumAge = options.MaximumAge,
            InfectiousDiseasePermanentDeferral = options.InfectiousDiseasePermanentDeferral,
            DrugUsePermanentDeferral = options.DrugUsePermanentDeferral
        };
    }

    private static void MapFromConfiguration(DeferralConfiguration configuration, DeferralSettings settings)
    {
        settings.MinimumHemoglobin = configuration.MinimumHemoglobin;
        settings.MaximumALT = configuration.MaximumALT;
        settings.DaysAfterSurgery = configuration.DaysAfterSurgery;
        settings.DaysAfterTransfusion = configuration.DaysAfterTransfusion;
        settings.DaysAfterTattoo = configuration.DaysAfterTattoo;
        settings.DaysAfterDentalWork = configuration.DaysAfterDentalWork;
        settings.DaysAfterVaccination = configuration.DaysAfterVaccination;
        settings.DaysAfterMalariaTravel = configuration.DaysAfterMalariaTravel;
        settings.DaysPostPregnancy = configuration.DaysPostPregnancy;
        settings.DaysPostBreastfeeding = configuration.DaysPostBreastfeeding;
        settings.DaysAfterFever = configuration.DaysAfterFever;
        settings.DaysBetweenDonations = configuration.DaysBetweenDonations;
        settings.MinimumAge = configuration.MinimumAge;
        settings.MaximumAge = configuration.MaximumAge;
    }
}
