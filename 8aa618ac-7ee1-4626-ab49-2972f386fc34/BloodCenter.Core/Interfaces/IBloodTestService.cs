using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IBloodTestService
{
    Task<BloodTestDto> RecordTestResultAsync(CreateBloodTestDto testDto, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodTestDto>> RecordBatchTestsAsync(IEnumerable<CreateBloodTestDto> testDtos, CancellationToken cancellationToken = default);
    Task<BloodTestDto> ReviewTestResultAsync(Guid testId, Guid reviewerId, TestResult result, string comment, CancellationToken cancellationToken = default);
    Task<BloodTestDto?> GetTestByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodTestDto>> GetTestsByDonationAsync(Guid donationId, CancellationToken cancellationToken = default);
    Task<PagedResult<BloodTestDto>> GetTestsAsync(SearchBloodTestQuery query, CancellationToken cancellationToken = default);
    Task<TestSummaryDto> GetTestsSummaryAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<bool> IsDonationSafeAsync(Guid donationId, CancellationToken cancellationToken = default);
    Task<TestCoverageValidationResult> ValidateFullTestCoverageAsync(Guid donationId, CancellationToken cancellationToken = default);
    Task QuarantineDonorProductsAsync(Guid donorId, string reason, CancellationToken cancellationToken = default);
    Task ReleaseDonationAsync(Guid donationId, CancellationToken cancellationToken = default);
    Task DeleteTestAsync(Guid id, CancellationToken cancellationToken = default);
}

public record CreateBloodTestDto(
    Guid DonationId,
    Guid TechnicianId,
    TestType TestType,
    TestItem TestItem,
    TestResult Result,
    DateTime TestTime,
    string? TestMethod,
    string? InstrumentUsed,
    string? ReagentLot,
    decimal? QuantitativeResult,
    string? Unit,
    string? ReferenceRange,
    string? Notes
);

public record SearchBloodTestQuery(
    Guid? DonationId,
    Guid? TechnicianId,
    TestType? TestType,
    TestItem? TestItem,
    TestResult? Result,
    DateTime? StartDate,
    DateTime? EndDate,
    int PageNumber = 1,
    int PageSize = 20
);

public record BloodTestDto(
    Guid Id,
    Guid DonationId,
    string DonationNumber,
    Guid TechnicianId,
    string TechnicianName,
    Guid? SecondReviewerId,
    string? SecondReviewerName,
    TestType TestType,
    TestItem TestItem,
    TestResult Result,
    DateTime? TestTime,
    DateTime? ReviewTime,
    string? TestMethod,
    string? InstrumentUsed,
    string? ReagentLot,
    decimal? QuantitativeResult,
    string? Unit,
    string? ReferenceRange,
    string? Notes,
    bool IsReReviewed,
    string? ReviewComment
);

public record TestSummaryDto(
    int TotalTests,
    int PositiveTests,
    int NegativeTests,
    int PendingTests,
    decimal PositiveRate,
    Dictionary<TestItem, int> ByTestItem,
    Dictionary<TestType, int> ByTestType
);

public record TestCoverageValidationResult(
    bool IsComplete,
    IEnumerable<string> MissingElisaFirstItems,
    IEnumerable<string> MissingElisaSecondItems,
    IEnumerable<string> MissingNatItems,
    IEnumerable<string> PositiveOrReactiveItems
);
