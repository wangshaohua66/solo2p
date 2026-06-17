using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Services;
using Microsoft.Extensions.Options;

namespace BloodCenter.Tests.Services;

public class DeferralStrategyServiceTests
{
    private readonly DeferralOptions _options;
    private readonly Mock<IOptions<DeferralOptions>> _optionsMock;
    private readonly DeferralStrategyService _deferralService;

    public DeferralStrategyServiceTests()
    {
        _options = new DeferralOptions
        {
            MinimumHemoglobin = 120.0,
            MaximumALT = 40.0,
            LowHemoglobinDeferralDays = 90,
            HighALTDeferralDays = 30,
            HBsAgPermanentDeferral = true,
            DaysAfterSurgery = 180,
            DaysAfterTransfusion = 365,
            DaysAfterTattoo = 180,
            DaysAfterDentalWork = 7,
            DaysAfterVaccination = 28,
            DaysAfterMalariaTravel = 365,
            DaysPostPregnancy = 180,
            DaysPostBreastfeeding = 90,
            DaysAfterFever = 14,
            DaysBetweenDonations = 56,
            MinimumAge = 18,
            MaximumAge = 55,
            InfectiousDiseasePermanentDeferral = true,
            DrugUsePermanentDeferral = true
        };

        _optionsMock = new Mock<IOptions<DeferralOptions>>();
        _optionsMock.Setup(o => o.Value).Returns(_options);
        _deferralService = new DeferralStrategyService(_optionsMock.Object);
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithNormalValues_ReturnsEligible()
    {
        const double hemoglobin = 135.0;
        const double alt = 25.0;
        const TestResult hbsAg = TestResult.Negative;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeTrue();
        result.PrimaryReason.Should().BeNull();
        result.DeferralDays.Should().BeNull();
        result.DeferralReasons.Should().BeEmpty();
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithLowHemoglobin_ReturnsDeferred()
    {
        const double hemoglobin = 100.0;
        const double alt = 25.0;
        const TestResult hbsAg = TestResult.Negative;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.PrimaryReason.Should().Be(DeferralReason.LowHemoglobin);
        result.DeferralDays.Should().Be(90);
        result.DeferralReasons.Should().ContainSingle(r => r.Contains("Hemoglobin"));
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithHighALT_ReturnsDeferred()
    {
        const double hemoglobin = 130.0;
        const double alt = 55.0;
        const TestResult hbsAg = TestResult.Negative;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.PrimaryReason.Should().Be(DeferralReason.HighALT);
        result.DeferralDays.Should().Be(30);
        result.DeferralReasons.Should().ContainSingle(r => r.Contains("ALT"));
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithPositiveHBsAg_ReturnsDeferred()
    {
        const double hemoglobin = 130.0;
        const double alt = 25.0;
        const TestResult hbsAg = TestResult.Positive;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.PrimaryReason.Should().Be(DeferralReason.InfectiousDiseaseHistory);
        result.DeferralDays.Should().Be(-1);
        result.DeferralReasons.Should().ContainSingle(r => r.Contains("HBsAg"));
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithReactiveHBsAg_ReturnsDeferred()
    {
        const double hemoglobin = 130.0;
        const double alt = 25.0;
        const TestResult hbsAg = TestResult.Reactive;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.DeferralReasons.Should().Contain(r => r.Contains("HBsAg"));
    }

    [Fact]
    public async Task EvaluateInitialScreeningAsync_WithMultipleFailures_ReturnsAllReasons()
    {
        const double hemoglobin = 100.0;
        const double alt = 60.0;
        const TestResult hbsAg = TestResult.Negative;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.DeferralReasons.Should().HaveCount(2);
        result.DeferralReasons.Should().Contain(r => r.Contains("Hemoglobin"));
        result.DeferralReasons.Should().Contain(r => r.Contains("ALT"));
        result.DeferralDays.Should().Be(90);
    }

    [Fact]
    public async Task EvaluateMedicalHistoryAsync_WithRecentSurgery_ReturnsDeferred()
    {
        var history = new MedicalHistoryFlags(
            HadRecentSurgery: true,
            SurgeryDate: DateTime.UtcNow.AddDays(-30),
            HasHepatitis: false,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            IsPregnant: false,
            IsBreastfeeding: false,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            HadVaccination: false,
            VaccinationDate: null,
            HasHighBloodPressure: false,
            HasFever: false,
            HadDrugs: false);

        var dateOfBirth = DateTime.UtcNow.AddYears(-30);

        var result = await _deferralService.EvaluateMedicalHistoryAsync(history, null, dateOfBirth);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.PrimaryReason.Should().Be(DeferralReason.RecentSurgery);
        result.DeferralReasons.Should().Contain(r => r.Contains("surgery"));
        result.DeferralDays.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task EvaluateMedicalHistoryAsync_WithNormalHistory_ReturnsEligible()
    {
        var history = new MedicalHistoryFlags(
            HadRecentSurgery: false,
            SurgeryDate: null,
            HasHepatitis: false,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            IsPregnant: false,
            IsBreastfeeding: false,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            HadVaccination: false,
            VaccinationDate: null,
            HasHighBloodPressure: false,
            HasFever: false,
            HadDrugs: false);

        var dateOfBirth = DateTime.UtcNow.AddYears(-30);

        var result = await _deferralService.EvaluateMedicalHistoryAsync(history, null, dateOfBirth);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeTrue();
        result.DeferralReasons.Should().BeEmpty();
        result.PrimaryReason.Should().BeNull();
    }

    [Fact]
    public async Task GetConfigurationAsync_ReturnsCurrentConfiguration()
    {
        var result = await _deferralService.GetConfigurationAsync();

        result.Should().NotBeNull();
        result.MinimumHemoglobin.Should().Be(120.0);
        result.MaximumALT.Should().Be(40.0);
        result.DaysAfterSurgery.Should().Be(180);
        result.DaysAfterTransfusion.Should().Be(365);
        result.DaysAfterTattoo.Should().Be(180);
        result.DaysAfterDentalWork.Should().Be(7);
        result.DaysAfterVaccination.Should().Be(28);
        result.DaysAfterMalariaTravel.Should().Be(365);
        result.DaysPostPregnancy.Should().Be(180);
        result.DaysPostBreastfeeding.Should().Be(90);
        result.DaysAfterFever.Should().Be(14);
        result.DaysBetweenDonations.Should().Be(56);
        result.MinimumAge.Should().Be(18);
        result.MaximumAge.Should().Be(55);
    }

    [Fact]
    public async Task UpdateConfigurationAsync_UpdatesConfigValues()
    {
        var newConfig = new DeferralConfiguration(
            MinimumHemoglobin: 125.0,
            MaximumALT: 45.0,
            DaysAfterSurgery: 200,
            DaysAfterTransfusion: 400,
            DaysAfterTattoo: 200,
            DaysAfterDentalWork: 10,
            DaysAfterVaccination: 35,
            DaysAfterMalariaTravel: 400,
            DaysPostPregnancy: 200,
            DaysPostBreastfeeding: 100,
            DaysAfterFever: 21,
            DaysBetweenDonations: 60,
            MinimumAge: 19,
            MaximumAge: 60);

        await _deferralService.UpdateConfigurationAsync(newConfig);

        var result = await _deferralService.GetConfigurationAsync();

        result.MinimumHemoglobin.Should().Be(125.0);
        result.MaximumALT.Should().Be(45.0);
        result.DaysAfterSurgery.Should().Be(200);
        result.MinimumAge.Should().Be(19);
        result.MaximumAge.Should().Be(60);
        result.DaysBetweenDonations.Should().Be(60);
    }

    [Fact]
    public async Task LowHemoglobinDeferral_HasCorrectDuration()
    {
        const double hemoglobin = 110.0;
        const double alt = 25.0;
        const TestResult hbsAg = TestResult.Negative;

        var result = await _deferralService.EvaluateInitialScreeningAsync(hemoglobin, alt, hbsAg);

        result.DeferralDays.Should().Be(_options.LowHemoglobinDeferralDays);
        result.DeferralDays.Should().Be(90);
    }

    [Fact]
    public async Task EvaluateMedicalHistoryAsync_WithPregnancy_ReturnsDeferred()
    {
        var history = new MedicalHistoryFlags(
            HadRecentSurgery: false,
            SurgeryDate: null,
            HasHepatitis: false,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            IsPregnant: true,
            IsBreastfeeding: false,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            HadVaccination: false,
            VaccinationDate: null,
            HasHighBloodPressure: false,
            HasFever: false,
            HadDrugs: false);

        var dateOfBirth = DateTime.UtcNow.AddYears(-30);

        var result = await _deferralService.EvaluateMedicalHistoryAsync(history, null, dateOfBirth);

        result.IsEligible.Should().BeFalse();
        result.PrimaryReason.Should().Be(DeferralReason.Pregnancy);
        result.DeferralDays.Should().Be(_options.DaysPostPregnancy);
    }

    [Fact]
    public async Task EvaluateMedicalHistoryAsync_WithRecentDonation_ReturnsDeferred()
    {
        var history = new MedicalHistoryFlags(
            HadRecentSurgery: false,
            SurgeryDate: null,
            HasHepatitis: false,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            IsPregnant: false,
            IsBreastfeeding: false,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            HadVaccination: false,
            VaccinationDate: null,
            HasHighBloodPressure: false,
            HasFever: false,
            HadDrugs: false);

        var dateOfBirth = DateTime.UtcNow.AddYears(-30);
        var lastDonationDate = DateTime.UtcNow.AddDays(-30);

        var result = await _deferralService.EvaluateMedicalHistoryAsync(history, lastDonationDate, dateOfBirth);

        result.IsEligible.Should().BeFalse();
        result.DeferralReasons.Should().Contain(r => r.Contains("last donation"));
        result.DeferralDays.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task EvaluateMedicalHistoryAsync_WithInfectiousDisease_ReturnsPermanentDeferral()
    {
        var history = new MedicalHistoryFlags(
            HadRecentSurgery: false,
            SurgeryDate: null,
            HasHepatitis: true,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            IsPregnant: false,
            IsBreastfeeding: false,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            HadVaccination: false,
            VaccinationDate: null,
            HasHighBloodPressure: false,
            HasFever: false,
            HadDrugs: false);

        var dateOfBirth = DateTime.UtcNow.AddYears(-30);

        var result = await _deferralService.EvaluateMedicalHistoryAsync(history, null, dateOfBirth);

        result.IsEligible.Should().BeFalse();
        result.DeferralDays.Should().Be(-1);
        result.PrimaryReason.Should().Be(DeferralReason.InfectiousDiseaseHistory);
    }
}
