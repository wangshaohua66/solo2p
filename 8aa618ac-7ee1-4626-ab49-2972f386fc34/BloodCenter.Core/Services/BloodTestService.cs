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
            _logger.LogWarning("Positive test result detected for donation {DonationId}, donor {DonorId}, item {TestItem}. Quarantining ALL donor products.", testDto.DonationId, donation.DonorId, testDto.TestItem);
            await QuarantineDonorProductsAsync(donation.DonorId, $"Positive result for {testDto.TestItem}", cancellationToken);
        }

        await CheckAndReleaseDonationIfSafeAsync(donation, cancellationToken);

        return _mapper.Map<BloodTestDto>(test);
    }

    public async Task<IEnumerable<BloodTestDto>> RecordBatchTestsAsync(IEnumerable<CreateBloodTestDto> testDtos, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting batch test recording with {Count} test entries", testDtos.Count());

        var testDtoList = testDtos.ToList();

        var distinctDonationIds = testDtoList
            .Select(t => t.DonationId)
            .Distinct()
            .ToList();

        _logger.LogInformation("Batch covers {Count} distinct donations: {DonationIds}", distinctDonationIds.Count, string.Join(", ", distinctDonationIds));

        var elisaItems = new[]
        {
            TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP
        };

        var natItems = new[]
        {
            TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA
        };

        _logger.LogInformation("Validating complete test coverage for all donations before any writes...");
        foreach (var donationId in distinctDonationIds)
        {
            _logger.LogDebug("Validating test coverage for donation {DonationId}", donationId);

            var donationTests = testDtoList.Where(t => t.DonationId == donationId).ToList();

            var missingElisaFirst = new List<string>();
            var missingElisaSecond = new List<string>();
            var missingNat = new List<string>();

            foreach (var item in elisaItems)
            {
                var hasFirst = donationTests.Any(t => t.TestItem == item && t.TestType == TestType.ElisaFirst);
                var hasSecond = donationTests.Any(t => t.TestItem == item && t.TestType == TestType.ElisaSecond);

                if (!hasFirst) missingElisaFirst.Add(item.ToString());
                if (!hasSecond) missingElisaSecond.Add(item.ToString());
            }

            foreach (var item in natItems)
            {
                var hasNat = donationTests.Any(t => t.TestItem == item && t.TestType == TestType.NucleicAcidTest);
                if (!hasNat) missingNat.Add(item.ToString());
            }

            var errors = new List<string>();
            if (missingElisaFirst.Any())
                errors.Add($"Missing ELISA First tests: {string.Join(", ", missingElisaFirst)}");
            if (missingElisaSecond.Any())
                errors.Add($"Missing ELISA Second tests: {string.Join(", ", missingElisaSecond)}");
            if (missingNat.Any())
                errors.Add($"Missing NAT tests: {string.Join(", ", missingNat)}");

            if (errors.Any())
            {
                _logger.LogError("Batch validation failed for donation {DonationId}: {Errors}", donationId, string.Join("; ", errors));
                throw new ValidationException(
                    $"Incomplete test panel for donation {donationId}. Batch must include all 11 required tests per donation (4 ELISA First, 4 ELISA Second, 3 NAT).",
                    errors);
            }

            _logger.LogDebug("Test coverage valid for donation {DonationId} - all 11 required tests present", donationId);
        }

        _logger.LogInformation("Batch validation passed for all {Count} donations. Proceeding with transaction...", distinctDonationIds.Count);

        var createdTests = new List<BloodTest>();
        var loadedDonations = new Dictionary<Guid, Donation>();

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            _logger.LogDebug("Transaction started. Creating test entities...");

            foreach (var testDto in testDtoList)
            {
                _logger.LogDebug("Processing test: Donation={DonationId}, TestItem={TestItem}, TestType={TestType}, Result={Result}",
                    testDto.DonationId, testDto.TestItem, testDto.TestType, testDto.Result);

                if (!loadedDonations.ContainsKey(testDto.DonationId))
                {
                    _logger.LogDebug("Loading donation {DonationId} for validation", testDto.DonationId);
                    var donation = await _unitOfWork.Donations.GetByIdAsync(testDto.DonationId, cancellationToken)
                        ?? throw new NotFoundException("Donation", testDto.DonationId);

                    if (donation.Status != DonationStatus.Completed)
                    {
                        _logger.LogError("Donation {DonationId} is in {Status} status, cannot record tests", testDto.DonationId, donation.Status);
                        throw new System.InvalidOperationException($"Cannot record test for donation in {donation.Status} status");
                    }

                    loadedDonations[testDto.DonationId] = donation;
                }

                var technician = await _unitOfWork.Users.GetByIdAsync(testDto.TechnicianId, cancellationToken)
                    ?? throw new NotFoundException("Technician", testDto.TechnicianId);

                if (technician.Role != UserRole.Technician)
                {
                    _logger.LogError("User {TechnicianId} is not a technician (Role={Role})", testDto.TechnicianId, technician.Role);
                    throw new ValidationException("User is not a technician");
                }

                var test = _mapper.Map<BloodTest>(testDto);
                test.CreatedAt = DateTime.UtcNow;
                test.TestTime = testDto.TestTime == default ? DateTime.UtcNow : testDto.TestTime;

                await _unitOfWork.BloodTests.AddAsync(test, cancellationToken);
                createdTests.Add(test);

                _logger.LogDebug("Test entity created: Id={TestId}, Donation={DonationId}, Item={TestItem}", test.Id, testDto.DonationId, testDto.TestItem);
            }

            _logger.LogInformation("All {Count} test entities created. Checking for positive/reactive results...", createdTests.Count);

            foreach (var test in createdTests)
            {
                if (test.Result == TestResult.Positive || test.Result == TestResult.Reactive)
                {
                    var donation = loadedDonations[test.DonationId];
                    _logger.LogWarning("Positive/reactive result detected in batch: Test={TestId}, Donation={DonationId}, Donor={DonorId}, Item={TestItem}. Quarantining ALL donor products.",
                        test.Id, test.DonationId, donation.DonorId, test.TestItem);
                    await QuarantineDonorProductsAsync(donation.DonorId, $"Batch positive result for {test.TestItem}", cancellationToken);
                }
            }

            _logger.LogInformation("Checking each donation for safe release...");
            foreach (var kvp in loadedDonations)
            {
                _logger.LogDebug("Checking release eligibility for donation {DonationId}", kvp.Key);
                await CheckAndReleaseDonationIfSafeAsync(kvp.Value, cancellationToken);
            }

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
            _logger.LogInformation("Batch test recording completed successfully. {Count} tests recorded across {DonationCount} donations.",
                createdTests.Count, distinctDonationIds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Batch test recording failed. Rolling back transaction...");
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            _logger.LogInformation("Transaction rolled back successfully");
            throw;
        }

        return _mapper.Map<IEnumerable<BloodTestDto>>(createdTests);
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
            _logger.LogWarning("Reviewed positive result for test {TestId}, donation {DonationId}, item {TestItem}. Loading donation to get donorId for full donor quarantine.", test.Id, test.DonationId, test.TestItem);
            var testDonation = await _unitOfWork.Donations.GetByIdAsync(test.DonationId, cancellationToken);
            if (testDonation != null)
            {
                _logger.LogWarning("Quarantining ALL products for donor {DonorId} due to reviewed positive result for {TestItem}", testDonation.DonorId, test.TestItem);
                await QuarantineDonorProductsAsync(testDonation.DonorId, $"Reviewed positive result for {test.TestItem}", cancellationToken);
            }
            else
            {
                _logger.LogError("Donation {DonationId} not found when attempting to quarantine donor products", test.DonationId);
                throw new NotFoundException("Donation", test.DonationId);
            }
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
