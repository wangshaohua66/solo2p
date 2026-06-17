using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Data.Repositories;
using BloodCenter.Infrastructure.Entities;
using BloodCenter.Infrastructure.Entities.Enums;
using Microsoft.EntityFrameworkCore;
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
            throw new InvalidOperationException($"Cannot record test for donation in {donation.Status} status");
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
        var test = await _unitOfWork.BloodTests.Query()
            .Where(t => t.Id == id && !t.IsDeleted)
            .Include(t => t.Donation)
            .Include(t => t.Technician)
            .Include(t => t.SecondReviewer)
            .FirstOrDefaultAsync(cancellationToken);

        return test == null ? null : _mapper.Map<BloodTestDto>(test);
    }

    public async Task<IEnumerable<BloodTestDto>> GetTestsByDonationAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var tests = await _unitOfWork.BloodTests.Query()
            .Where(t => t.DonationId == donationId && !t.IsDeleted)
            .Include(t => t.Technician)
            .Include(t => t.SecondReviewer)
            .OrderBy(t => t.TestType)
            .ThenBy(t => t.TestItem)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<BloodTestDto>>(tests);
    }

    public async Task<PagedResult<BloodTestDto>> GetTestsAsync(SearchBloodTestQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.BloodTests.Query().Where(t => !t.IsDeleted);

        if (query.DonationId.HasValue)
        {
            queryable = queryable.Where(t => t.DonationId == query.DonationId.Value);
        }

        if (query.TechnicianId.HasValue)
        {
            queryable = queryable.Where(t => t.TechnicianId == query.TechnicianId.Value);
        }

        if (query.TestType.HasValue)
        {
            queryable = queryable.Where(t => t.TestType == query.TestType.Value);
        }

        if (query.TestItem.HasValue)
        {
            queryable = queryable.Where(t => t.TestItem == query.TestItem.Value);
        }

        if (query.Result.HasValue)
        {
            queryable = queryable.Where(t => t.Result == query.Result.Value);
        }

        if (query.StartDate.HasValue)
        {
            queryable = queryable.Where(t => t.TestTime >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            queryable = queryable.Where(t => t.TestTime <= query.EndDate.Value);
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .Include(t => t.Donation)
            .Include(t => t.Technician)
            .Include(t => t.SecondReviewer)
            .OrderByDescending(t => t.TestTime)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<BloodTestDto>(
            _mapper.Map<IEnumerable<BloodTestDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<TestSummaryDto> GetTestsSummaryAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var tests = await _unitOfWork.BloodTests.Query()
            .Where(t => t.TestTime >= startDate && t.TestTime <= endDate && !t.IsDeleted)
            .ToListAsync(cancellationToken);

        return new TestSummaryDto(
            TotalTests: tests.Count,
            PositiveTests: tests.Count(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive),
            NegativeTests: tests.Count(t => t.Result == TestResult.Negative || t.Result == TestResult.NonReactive),
            PendingTests: tests.Count(t => t.Result == TestResult.Pending),
            PositiveRate: tests.Any() ? Math.Round((decimal)tests.Count(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive) / tests.Count * 100, 2) : 0,
            ByTestItem: tests.GroupBy(t => t.TestItem).ToDictionary(g => g.Key, g => g.Count()),
            ByTestType: tests.GroupBy(t => t.TestType).ToDictionary(g => g.Key, g => g.Count())
        );
    }

    public async Task<bool> IsDonationSafeAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var requiredItems = new[]
        {
            TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP,
            TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA
        };

        var tests = await _unitOfWork.BloodTests.Query()
            .Where(t => t.DonationId == donationId && !t.IsDeleted)
            .ToListAsync(cancellationToken);

        foreach (var item in requiredItems)
        {
            var itemTests = tests.Where(t => t.TestItem == item).ToList();
            if (!itemTests.Any())
            {
                return false;
            }

            if (itemTests.Any(t => t.Result == TestResult.Positive || t.Result == TestResult.Reactive))
            {
                return false;
            }
        }

        var elisaFirst = tests.Where(t => t.TestType == TestType.ElisaFirst).ToList();
        var elisaSecond = tests.Where(t => t.TestType == TestType.ElisaSecond).ToList();
        var nat = tests.Where(t => t.TestType == TestType.NucleicAcidTest).ToList();

        if (elisaFirst.Count < 4 || elisaSecond.Count < 4 || nat.Count < 3)
        {
            return false;
        }

        return true;
    }

    public async Task QuarantineDonorProductsAsync(Guid donorId, string reason, CancellationToken cancellationToken = default)
    {
        var donationIds = await _unitOfWork.Donations.Query()
            .Where(d => d.DonorId == donorId && !d.IsDeleted)
            .Select(d => d.Id)
            .ToListAsync(cancellationToken);

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
        if (!await IsDonationSafeAsync(donationId, cancellationToken))
        {
            throw new TestNotCompletedException(donationId);
        }

        var donation = await _unitOfWork.Donations.GetByIdAsync(donationId, cancellationToken)
            ?? throw new NotFoundException("Donation", donationId);

        donation.Status = DonationStatus.Released;
        donation.AllTestsPassed = true;
        donation.IsQuarantined = false;
        donation.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Donations.Update(donation);
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

        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.DonationId == donationId && !bp.IsDeleted)
            .ToListAsync(cancellationToken);

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
            donation.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Donations.Update(donation);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }
}
