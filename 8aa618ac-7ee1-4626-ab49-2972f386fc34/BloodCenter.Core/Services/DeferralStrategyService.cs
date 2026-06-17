using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BloodCenter.Core.Services;

public class DeferralStrategyService : IDeferralStrategy
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOptions<DeferralOptions> _optionsSnapshot;
    private readonly ILogger<DeferralStrategyService> _logger;
    private DeferralOptions _options;
    private volatile bool _isLoaded;
    private readonly object _lock = new();

    public DeferralStrategyService(IUnitOfWork unitOfWork, IOptions<DeferralOptions> optionsSnapshot, ILogger<DeferralStrategyService> logger)
    {
        _unitOfWork = unitOfWork;
        _optionsSnapshot = optionsSnapshot;
        _logger = logger;
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

        _logger.LogInformation("EvaluateMedicalHistoryAsync: Starting evaluation for donor DOB={DOB}, LastDonation={LastDonation}",
            donorDateOfBirth.ToString("yyyy-MM-dd"), donorLastDonationDate?.ToString("yyyy-MM-dd") ?? "N/A");

        var deferralReasons = new List<string>();
        DeferralReason? primaryReason = null;
        int maxDeferralDays = 0;
        bool isPermanent = false;
        var now = DateTime.UtcNow;

        var age = now.Year - donorDateOfBirth.Year;
        if (donorDateOfBirth > now.AddYears(-age)) age--;

        _logger.LogInformation("Rule 1 - Age check: Age={Age}, Range={Min}-{Max}", age, _options.MinimumAge, _options.MaximumAge);
        if (age < _options.MinimumAge || age > _options.MaximumAge)
        {
            deferralReasons.Add($"Age {age} is outside eligible range ({_options.MinimumAge}-{_options.MaximumAge} years)");
            primaryReason = DeferralReason.Other;
            _logger.LogWarning("Rule 1 - Age check: DEFERRED - Age {Age} out of range", age);
        }

        _logger.LogInformation("Rule 2 - Days since last donation: LastDonation={LastDonation}", donorLastDonationDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (donorLastDonationDate.HasValue)
        {
            var daysSinceLastDonation = (now - donorLastDonationDate.Value).TotalDays;
            if (daysSinceLastDonation < _options.DaysBetweenDonations)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysBetweenDonations - daysSinceLastDonation);
                deferralReasons.Add($"Less than {_options.DaysBetweenDonations} days since last donation ({(int)daysSinceLastDonation} days ago)");
                primaryReason ??= DeferralReason.Other;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 2 - Days since last donation: DEFERRED - {DaysSince} days since last donation, need {DaysBetween}, {DaysRemaining} days remaining",
                    (int)daysSinceLastDonation, _options.DaysBetweenDonations, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 3 - Recent surgery (configurable): HadSurgery={HadSurgery}, SurgeryDate={SurgeryDate}",
            history.HadRecentSurgery, history.SurgeryDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadRecentSurgery && history.SurgeryDate.HasValue)
        {
            var daysSinceSurgery = (now - history.SurgeryDate.Value).TotalDays;
            if (daysSinceSurgery < _options.DaysAfterSurgery)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterSurgery - daysSinceSurgery);
                deferralReasons.Add($"Recent surgery within {_options.DaysAfterSurgery} days ({(int)daysSinceSurgery} days ago)");
                primaryReason ??= DeferralReason.RecentSurgery;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 3 - Recent surgery (configurable): DEFERRED - Surgery {DaysSince} days ago, config threshold {ConfigDays}, {DaysRemaining} days remaining",
                    (int)daysSinceSurgery, _options.DaysAfterSurgery, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 4 - Recent surgery (HARD 6-month minimum): HadSurgery={HadSurgery}, SurgeryDate={SurgeryDate}",
            history.HadRecentSurgery, history.SurgeryDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadRecentSurgery && history.SurgeryDate.HasValue)
        {
            var hardLimitDays = 180;
            var daysSinceSurgery = (now - history.SurgeryDate.Value).TotalDays;
            if (daysSinceSurgery < hardLimitDays)
            {
                var hardDaysRemaining = (int)Math.Ceiling(hardLimitDays - daysSinceSurgery);
                deferralReasons.Add($"Surgery within 6 months: hard deferral of {hardLimitDays} days ({(int)daysSinceSurgery} days ago, {hardDaysRemaining} days remaining)");
                primaryReason ??= DeferralReason.RecentSurgery;
                maxDeferralDays = Math.Max(maxDeferralDays, hardDaysRemaining);
                _logger.LogWarning("Rule 4 - Recent surgery (HARD 6-month): DEFERRED - Surgery {DaysSince} days ago, hard limit {HardLimit} days, {DaysRemaining} days remaining",
                    (int)daysSinceSurgery, hardLimitDays, hardDaysRemaining);
            }
        }

        _logger.LogInformation("Rule 5 - Recent blood transfusion: HadTransfusion={HadTransfusion}, TransfusionDate={TransfusionDate}",
            history.HadBloodTransfusion, history.TransfusionDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadBloodTransfusion && history.TransfusionDate.HasValue)
        {
            var daysSinceTransfusion = (now - history.TransfusionDate.Value).TotalDays;
            if (daysSinceTransfusion < _options.DaysAfterTransfusion)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterTransfusion - daysSinceTransfusion);
                deferralReasons.Add($"Recent blood transfusion within {_options.DaysAfterTransfusion} days ({(int)daysSinceTransfusion} days ago)");
                primaryReason ??= DeferralReason.RecentBloodTransfusion;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 5 - Recent blood transfusion: DEFERRED - {DaysSince} days ago, threshold {ThresholdDays}, {DaysRemaining} days remaining",
                    (int)daysSinceTransfusion, _options.DaysAfterTransfusion, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 6 - Recent tattoo: HadTattoo={HadTattoo}, TattooDate={TattooDate}",
            history.HadTattoo, history.TattooDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadTattoo && history.TattooDate.HasValue)
        {
            var daysSinceTattoo = (now - history.TattooDate.Value).TotalDays;
            if (daysSinceTattoo < _options.DaysAfterTattoo)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterTattoo - daysSinceTattoo);
                deferralReasons.Add($"Recent tattoo within {_options.DaysAfterTattoo} days ({(int)daysSinceTattoo} days ago)");
                primaryReason ??= DeferralReason.RecentTattoo;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 6 - Recent tattoo: DEFERRED - {DaysSince} days ago, threshold {ThresholdDays}, {DaysRemaining} days remaining",
                    (int)daysSinceTattoo, _options.DaysAfterTattoo, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 7 - Recent dental work: HadDentalWork={HadDentalWork}, DentalWorkDate={DentalWorkDate}",
            history.HadDentalWork, history.DentalWorkDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadDentalWork && history.DentalWorkDate.HasValue)
        {
            var daysSinceDentalWork = (now - history.DentalWorkDate.Value).TotalDays;
            if (daysSinceDentalWork < _options.DaysAfterDentalWork)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterDentalWork - daysSinceDentalWork);
                deferralReasons.Add($"Recent dental work within {_options.DaysAfterDentalWork} days ({(int)daysSinceDentalWork} days ago)");
                primaryReason ??= DeferralReason.RecentDentalWork;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 7 - Recent dental work: DEFERRED - {DaysSince} days ago, threshold {ThresholdDays}, {DaysRemaining} days remaining",
                    (int)daysSinceDentalWork, _options.DaysAfterDentalWork, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 8 - Recent vaccination: HadVaccination={HadVaccination}, VaccinationDate={VaccinationDate}",
            history.HadVaccination, history.VaccinationDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.HadVaccination && history.VaccinationDate.HasValue)
        {
            var daysSinceVaccination = (now - history.VaccinationDate.Value).TotalDays;
            if (daysSinceVaccination < _options.DaysAfterVaccination)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterVaccination - daysSinceVaccination);
                deferralReasons.Add($"Recent vaccination within {_options.DaysAfterVaccination} days ({(int)daysSinceVaccination} days ago)");
                primaryReason ??= DeferralReason.RecentVaccination;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 8 - Recent vaccination: DEFERRED - {DaysSince} days ago, threshold {ThresholdDays}, {DaysRemaining} days remaining",
                    (int)daysSinceVaccination, _options.DaysAfterVaccination, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 9 - Malaria area travel: Traveled={Traveled}, TravelDate={TravelDate}",
            history.TraveledToMalariaArea, history.TravelDate?.ToString("yyyy-MM-dd") ?? "N/A");
        if (history.TraveledToMalariaArea && history.TravelDate.HasValue)
        {
            var daysSinceTravel = (now - history.TravelDate.Value).TotalDays;
            if (daysSinceTravel < _options.DaysAfterMalariaTravel)
            {
                var daysRemaining = (int)Math.Ceiling(_options.DaysAfterMalariaTravel - daysSinceTravel);
                deferralReasons.Add($"Travel to malaria area within {_options.DaysAfterMalariaTravel} days ({(int)daysSinceTravel} days ago)");
                primaryReason ??= DeferralReason.TravelToMalariaArea;
                maxDeferralDays = Math.Max(maxDeferralDays, daysRemaining);
                _logger.LogWarning("Rule 9 - Malaria area travel: DEFERRED - {DaysSince} days ago, threshold {ThresholdDays}, {DaysRemaining} days remaining",
                    (int)daysSinceTravel, _options.DaysAfterMalariaTravel, daysRemaining);
            }
        }

        _logger.LogInformation("Rule 10 - Pregnancy: IsPregnant={IsPregnant}", history.IsPregnant);
        if (history.IsPregnant)
        {
            deferralReasons.Add("Currently pregnant");
            primaryReason ??= DeferralReason.Pregnancy;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysPostPregnancy);
            _logger.LogWarning("Rule 10 - Pregnancy: DEFERRED - Currently pregnant, {DaysPost} days post-pregnancy deferral", _options.DaysPostPregnancy);
        }

        _logger.LogInformation("Rule 11 - Breastfeeding: IsBreastfeeding={IsBreastfeeding}", history.IsBreastfeeding);
        if (history.IsBreastfeeding)
        {
            deferralReasons.Add("Currently breastfeeding");
            primaryReason ??= DeferralReason.Breastfeeding;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysPostBreastfeeding);
            _logger.LogWarning("Rule 11 - Breastfeeding: DEFERRED - Currently breastfeeding, {DaysPost} days post-breastfeeding deferral", _options.DaysPostBreastfeeding);
        }

        _logger.LogInformation("Rule 12 - Fever: HasFever={HasFever}", history.HasFever);
        if (history.HasFever)
        {
            deferralReasons.Add("Current fever");
            primaryReason ??= DeferralReason.Fever;
            maxDeferralDays = Math.Max(maxDeferralDays, _options.DaysAfterFever);
            _logger.LogWarning("Rule 12 - Fever: DEFERRED - Current fever, {DaysAfter} days deferral after fever", _options.DaysAfterFever);
        }

        _logger.LogInformation("Rule 13 - High blood pressure: HasHighBloodPressure={HasHighBloodPressure}", history.HasHighBloodPressure);
        if (history.HasHighBloodPressure)
        {
            deferralReasons.Add("High blood pressure");
            primaryReason ??= DeferralReason.HighBloodPressure;
            _logger.LogWarning("Rule 13 - High blood pressure: DEFERRED - High blood pressure detected");
        }

        _logger.LogInformation("Rule 14 - Heart disease: HasHeartDisease={HasHeartDisease}", history.HasHeartDisease);
        if (history.HasHeartDisease)
        {
            deferralReasons.Add("History of heart disease - requires medical clearance");
            primaryReason ??= DeferralReason.Other;
            _logger.LogWarning("Rule 14 - Heart disease: DEFERRED - History of heart disease requires medical clearance");
        }

        _logger.LogInformation("Rule 15 - Diabetes: HasDiabetes={HasDiabetes}", history.HasDiabetes);
        if (history.HasDiabetes)
        {
            deferralReasons.Add("History of diabetes - requires medical evaluation");
            primaryReason ??= DeferralReason.Other;
            _logger.LogWarning("Rule 15 - Diabetes: DEFERRED - History of diabetes requires medical evaluation");
        }

        _logger.LogInformation("Rule 16 - Cancer: HasCancer={HasCancer}", history.HasCancer);
        if (history.HasCancer)
        {
            deferralReasons.Add("History of cancer");
            primaryReason ??= DeferralReason.Other;
            isPermanent = true;
            _logger.LogWarning("Rule 16 - Cancer: DEFERRED (PERMANENT) - History of cancer");
        }

        _logger.LogInformation("Rule 17 - Infectious disease: Hep={Hep}, HIV={HIV}, Syph={Syph}, Malaria={Malaria}",
            history.HasHepatitis, history.HasHIV, history.HasSyphilis, history.HasMalaria);
        if (history.HasHepatitis || history.HasHIV || history.HasSyphilis || history.HasMalaria)
        {
            deferralReasons.Add("History of infectious disease: hepatitis, HIV, syphilis, or malaria");
            primaryReason ??= DeferralReason.InfectiousDiseaseHistory;
            if (_options.InfectiousDiseasePermanentDeferral)
            {
                isPermanent = true;
            }
            _logger.LogWarning("Rule 17 - Infectious disease: DEFERRED{Perm} - History of hepatitis/HIV/syphilis/malaria",
                _options.InfectiousDiseasePermanentDeferral ? " (PERMANENT)" : "");
        }

        _logger.LogInformation("Rule 18 - Drug use: HadDrugs={HadDrugs}", history.HadDrugs);
        if (history.HadDrugs)
        {
            deferralReasons.Add("History of drug use");
            primaryReason ??= DeferralReason.Other;
            if (_options.DrugUsePermanentDeferral)
            {
                isPermanent = true;
            }
            _logger.LogWarning("Rule 18 - Drug use: DEFERRED{Perm} - History of drug use",
                _options.DrugUsePermanentDeferral ? " (PERMANENT)" : "");
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

        _logger.LogInformation("EvaluateMedicalHistoryAsync: Completed - Eligible={Eligible}, PrimaryReason={PrimaryReason}, DeferralDays={DeferralDays}, ReasonCount={ReasonCount}",
            isEligible, primaryReason?.ToString() ?? "N/A", finalDeferralDays?.ToString() ?? "N/A", deferralReasons.Count);

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
