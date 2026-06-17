using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class BloodTestService : IBloodTestService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<BloodTestService> _logger;

    public BloodTestService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<BloodTestService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<BloodTestDto> RecordTestResultAsync(CreateBloodTestDto testDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Recording test result for donation {DonationId}", testDto.DonationId);

        var donation = await _unitOfWork.Donations.GetByIdAsync(testDto.DonationId, cancellationToken)
            ?? throw new NotFoundException("Donation", testDto.DonationId);

        if (donation.Status != DonationStatus.Completed)
        {
            throw new System.InvalidOperationException($"Cannot record test for donation in {donation.Status} status");
        }

        var technician = await _unitOfWork.Users.GetByIdAsync(testDto.TechnicianId, cancellationToken)
            ?? throw new NotFoundException("Technician", testDto.TechnicianId);

        if (technician.Role != UserRole.Technician)
        {
            throw new ValidationException("User is not a technician");
        }

        var test = _mapper.Map<BloodTest>(testDto);
        test.CreatedAt = DateTime.UtcNow;
        test.TestTime = testDto.TestTime == default ? DateTime.UtcNow : testDto.TestTime;

        await _unitOfWork.BloodTests.AddAsync(test, cancellationToken);

        if (testDto.Result == TestResult.Positive || testDto.Result == TestResult.Reactive)
        {
            _logger.LogWarning("Positive test result detected for donation {DonationId}, item {TestItem}", testDto.DonationId, testDto.TestItem);
            await QuarantineDonationProductsAsync(testDto.DonationId, $"Positive result for {testDto.TestItem}", cancellationToken);
        }

        await CheckAndReleaseDonationIfSafeAsync(donation, cancellationToken);

        return _mapper.Map<BloodTestDto>(test);
    }

    public async Task<IEnumerable<BloodTestDto>> RecordBatchTestsAsync(IEnumerable<CreateBloodTestDto> testDtos, CancellationToken cancellationToken = default)
    {
        var results = new List<BloodTestDto>();
        foreach (var testDto in testDtos)
        {
            results.Add(await RecordTestResultAsync(testDto, cancellationToken));
        }
        return results;
    }

    public async Task<BloodTestDto> ReviewTestResultAsync(Guid testId, Guid reviewerId, TestResult result, string comment, CancellationToken cancellationToken = default)
    {
        var test = await _unitOfWork.BloodTests.GetByIdAsync(testId, cancellationToken)
            ?? throw new NotFoundException("BloodTest", testId);

        var reviewer = await _unitOfWork.Users.GetByIdAsync(reviewerId, cancellationToken)
            ?? throw new NotFoundException("Reviewer", reviewerId);

        if (reviewer.Role != UserRole.Technician && reviewer.Role != UserRole.Administrator)
        {
            throw new ForbiddenException("Only technicians or administrators can review test results");
        }

        if (test.TechnicianId == reviewerId)
        {
            throw new ForbiddenException("Cannot review own test results");
        }

        var donationTests = await _unitOfWork.BloodTests.FindAsync(
            t => t.DonationId == test.DonationId && !t.IsDeleted,
            cancellationToken);

        var alreadyReviewed = donationTests
            .Where(t => t.IsReReviewed && t.SecondReviewerId.HasValue && t.Id != testId)
            .ToList();

        if (alreadyReviewed.Any())
        {
            var firstReviewerId = alreadyReviewed.First().SecondReviewerId;
            if (firstReviewerId != reviewerId)
            {
                throw new ValidationException(
                    "All tests for a donation must be reviewed by the same second reviewer. " +
                    $"This donation's tests are already being reviewed by a different reviewer.");
            }
        }

        var pendingTests = donationTests
            .Where(t => !t.IsReReviewed && t.Id != testId)
            .ToList();

        test.SecondReviewerId = reviewerId;
        test.Result = result;
        test.IsReReviewed = true;
        test.ReviewTime = DateTime.UtcNow;
        test.ReviewComment = comment;
        test.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.BloodTests.Update(test);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (result == TestResult.Positive || result == TestResult.Reactive)
        {
            await QuarantineDonationProductsAsync(test.DonationId, $"Reviewed positive result for {test.TestItem}", cancellationToken);
        }
        else
        {
            var donation = await _unitOfWork.Donations.GetByIdAsync(test.DonationId, cancellationToken);
            if (donation != null)
            {
                await CheckAndReleaseDonationIfSafeAsync(donation, cancellationToken);
            }
        }

        return _mapper.Map<BloodTestDto>(test);
    }

    public async Task<BloodTestDto?> GetTestByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var test = await _unitOfWork.BloodTests.FirstOrDefaultAsync(
            t => t.Id == id && !t.IsDeleted,
            new[] { "Donation", "Technician", "SecondReviewer" },
            cancellationToken);

        return test == null ? null : _mapper.Map<BloodTestDto>(test);
    }

    public async Task<IEnumerable<BloodTestDto>> GetTestsByDonationAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var tests = await _unitOfWork.BloodTests.FindAsync(
            t => t.DonationId == donationId && !t.IsDeleted,
            t => t.TestType,
            false,
            new[] { "Technician", "SecondReviewer" },
            cancellationToken);

        tests = tests.OrderBy(t => t.TestType).ThenBy(t => t.TestItem).ToList();

        return _mapper.Map<IEnumerable<BloodTestDto>>(tests);
    }

    public async Task<PagedResult<BloodTestDto>> GetTestsAsync(SearchBloodTestQuery query, CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await _unitOfWork.BloodTests.GetPagedAsync(
            query.PageNumber,
            query.PageSize,
            t => !t.IsDeleted
                && (!query.DonationId.HasValue || t.DonationId == query.DonationId.Value)
                && (!query.TechnicianId.HasValue || t.TechnicianId == query.TechnicianId.Value)
                && (!query.TestType.HasValue || t.TestType == query.TestType.Value)
                && (!query.TestItem.HasValue || t.TestItem == query.TestItem.Value)
                && (!query.Result.HasValue || t.Result == query.Result.Value)
                && (!query.StartDate.HasValue || t.TestTime >= query.StartDate.Value)
                && (!query.EndDate.HasValue || t.TestTime <= query.EndDate.Value),
            t => t.TestTime,
            true,
            null,
            true,
            new[] { "Donation", "Technician", "SecondReviewer" },
            cancellationToken);

        return new PagedResult<BloodTestDto>(
            _mapper.Map<IEnumerable<BloodTestDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<TestSummaryDto> GetTestsSummaryAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var tests = await _unitOfWork.BloodTests.FindAsync(
            t => t.TestTime >= startDate && t.TestTime <= endDate && !t.IsDeleted,
            cancellationToken);

        return new TestSummaryDto(
            TotalTests: tests.Count(),
            PositiveTests: tests.Count(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive),
            NegativeTests: tests.Count(t => t.Result == TestResult.Negative || t.Result == TestResult.NonReactive),
            PendingTests: tests.Count(t => t.Result == TestResult.Pending),
            PositiveRate: tests.Any() ? Math.Round((decimal)tests.Count(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive) / tests.Count() * 100, 2) : 0,
            ByTestItem: tests.GroupBy(t => t.TestItem).ToDictionary(g => g.Key, g => g.Count()),
            ByTestType: tests.GroupBy(t => t.TestType).ToDictionary(g => g.Key, g => g.Count())
        );
    }

    public async Task<bool> IsDonationSafeAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var result = await ValidateFullTestCoverageAsync(donationId, cancellationToken);
        return result.IsComplete && !result.PositiveOrReactiveItems.Any();
    }

    public async Task<TestCoverageValidationResult> ValidateFullTestCoverageAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var elisaItems = new[]
        {
            TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP
        };

        var natItems = new[]
        {
            TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA
        };

        var tests = await _unitOfWork.BloodTests.FindAsync(
            t => t.DonationId == donationId && !t.IsDeleted,
            cancellationToken);

        var missingElisaFirst = new List<string>();
        var missingElisaSecond = new List<string>();
        var missingNat = new List<string>();
        var positiveOrReactive = new List<string>();

        foreach (var item in elisaItems)
        {
            var hasFirst = tests.Any(t => t.TestItem == item && t.TestType == TestType.ElisaFirst);
            var hasSecond = tests.Any(t => t.TestItem == item && t.TestType == TestType.ElisaSecond);

            if (!hasFirst)
            {
                missingElisaFirst.Add(item.ToString());
            }

            if (!hasSecond)
            {
                missingElisaSecond.Add(item.ToString());
            }

            var itemTests = tests.Where(t => t.TestItem == item).ToList();
            if (itemTests.Any(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive))
            {
                positiveOrReactive.Add(item.ToString());
            }
        }

        foreach (var item in natItems)
        {
            var hasNat = tests.Any(t => t.TestItem == item && t.TestType == TestType.NucleicAcidTest);

            if (!hasNat)
            {
                missingNat.Add(item.ToString());
            }

            var itemTests = tests.Where(t => t.TestItem == item).ToList();
            if (itemTests.Any(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive))
            {
                positiveOrReactive.Add(item.ToString());
            }
        }

        var isComplete = !missingElisaFirst.Any()
                         && !missingElisaSecond.Any()
                         && !missingNat.Any();

        return new TestCoverageValidationResult(
            isComplete,
            missingElisaFirst,
            missingElisaSecond,
            missingNat,
            positiveOrReactive.Distinct().ToList()
        );
    }

    public async Task QuarantineDonorProductsAsync(Guid donorId, string reason, CancellationToken cancellationToken = default)
    {
        var donations = await _unitOfWork.Donations.FindAsync(
            d => d.DonorId == donorId && !d.IsDeleted,
            cancellationToken);
        var donationIds = donations.Select(d => d.Id).ToList();

        foreach (var donationId in donationIds)
        {
            await QuarantineDonationProductsAsync(donationId, reason, cancellationToken);
        }

        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken);
        if (donor != null)
        {
            donor.Status = DonorStatus.PermanentlyDeferred;
            donor.DeferralReason = DeferralReason.InfectiousDiseaseHistory;
            _unitOfWork.Donors.Update(donor);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ReleaseDonationAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var coverageResult = await ValidateFullTestCoverageAsync(donationId, cancellationToken);

        if (!coverageResult.IsComplete || coverageResult.PositiveOrReactiveItems.Any())
        {
            var errors = new List<string>();

            if (coverageResult.MissingElisaFirstItems.Any())
            {
                errors.Add($"Missing ELISA First tests: {string.Join(", ", coverageResult.MissingElisaFirstItems)}");
            }

            if (coverageResult.MissingElisaSecondItems.Any())
            {
                errors.Add($"Missing ELISA Second tests: {string.Join(", ", coverageResult.MissingElisaSecondItems)}");
            }

            if (coverageResult.MissingNatItems.Any())
            {
                errors.Add($"Missing NAT tests: {string.Join(", ", coverageResult.MissingNatItems)}");
            }

            if (coverageResult.PositiveOrReactiveItems.Any())
            {
                errors.Add($"Positive/Reactive results: {string.Join(", ", coverageResult.PositiveOrReactiveItems)}");
            }

            throw new ValidationException(
                $"Cannot release donation {donationId}. Test coverage is incomplete.",
                errors);
        }

        var donation = await _unitOfWork.Donations.GetByIdAsync(donationId, cancellationToken)
            ?? throw new NotFoundException("Donation", donationId);

        donation.Status = DonationStatus.Released;
        donation.AllTestsPassed = true;
        donation.IsQuarantined = false;
        donation.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Donations.Update(donation);

        var products = await _unitOfWork.BloodProducts.FindAsync(
            bp => bp.DonationId == donationId && !bp.IsDeleted && bp.Status == InventoryStatus.Quarantined,
            cancellationToken);

        foreach (var product in products)
        {
            product.Status = InventoryStatus.InStock;
            product.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodProducts.Update(product);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Donation {DonationId} released", donationId);
    }

    public async Task DeleteTestAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var test = await _unitOfWork.BloodTests.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("BloodTest", id);

        _unitOfWork.BloodTests.Delete(test);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task QuarantineDonationProductsAsync(Guid donationId, string reason, CancellationToken cancellationToken)
    {
        var donation = await _unitOfWork.Donations.GetByIdAsync(donationId, cancellationToken);
        if (donation != null)
        {
            donation.IsQuarantined = true;
            donation.QuarantineReason = reason;
            donation.Status = DonationStatus.Quarantined;
            donation.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Donations.Update(donation);
        }

        var products = await _unitOfWork.BloodProducts.FindAsync(
            bp => bp.DonationId == donationId && !bp.IsDeleted,
            cancellationToken);

        foreach (var product in products)
        {
            product.Status = InventoryStatus.Quarantined;
            product.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodProducts.Update(product);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task CheckAndReleaseDonationIfSafeAsync(Donation donation, CancellationToken cancellationToken)
    {
        if (await IsDonationSafeAsync(donation.Id, cancellationToken))
        {
            donation.Status = DonationStatus.Released;
            donation.AllTestsPassed = true;
            donation.IsQuarantined = false;
            donation.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Donations.Update(donation);

            var products = await _unitOfWork.BloodProducts.FindAsync(
                bp => bp.DonationId == donation.Id && !bp.IsDeleted && bp.Status == InventoryStatus.Quarantined,
                cancellationToken);

            foreach (var product in products)
            {
                product.Status = InventoryStatus.InStock;
                product.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.BloodProducts.Update(product);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }
}
