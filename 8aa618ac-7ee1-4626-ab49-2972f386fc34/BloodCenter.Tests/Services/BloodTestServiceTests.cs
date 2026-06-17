using AutoMapper;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Services;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Tests.Services;

public class BloodTestServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IMapper> _mapperMock;
    private readonly Mock<ILogger<BloodTestService>> _loggerMock;
    private readonly BloodTestService _bloodTestService;

    public BloodTestServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _mapperMock = new Mock<IMapper>();
        _loggerMock = new Mock<ILogger<BloodTestService>>();
        _bloodTestService = new BloodTestService(_unitOfWorkMock.Object, _mapperMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task ValidateFullTestCoverageAsync_WithAllTestsPresent_ReturnsValid()
    {
        var donationId = Guid.NewGuid();
        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        var tests = new List<BloodTest>();

        foreach (var item in elisaItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaFirst,
                TestItem = item,
                Result = TestResult.Negative
            });
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaSecond,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in natItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.NucleicAcidTest,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.ValidateFullTestCoverageAsync(donationId);

        result.Should().NotBeNull();
        result.IsComplete.Should().BeTrue();
        result.MissingElisaFirstItems.Should().BeEmpty();
        result.MissingElisaSecondItems.Should().BeEmpty();
        result.MissingNatItems.Should().BeEmpty();
        result.PositiveOrReactiveItems.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidateFullTestCoverageAsync_MissingElisaFirst_ReturnsInvalid()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>();

        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        foreach (var item in elisaItems.Skip(1))
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaFirst,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in elisaItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaSecond,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in natItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.NucleicAcidTest,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.ValidateFullTestCoverageAsync(donationId);

        result.Should().NotBeNull();
        result.IsComplete.Should().BeFalse();
        result.MissingElisaFirstItems.Should().ContainSingle();
        result.MissingElisaFirstItems.Should().Contain("HBsAg");
    }

    [Fact]
    public async Task ValidateFullTestCoverageAsync_MissingElisaSecond_ReturnsInvalid()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>();

        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        foreach (var item in elisaItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaFirst,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in elisaItems.Take(3))
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaSecond,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in natItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.NucleicAcidTest,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.ValidateFullTestCoverageAsync(donationId);

        result.Should().NotBeNull();
        result.IsComplete.Should().BeFalse();
        result.MissingElisaSecondItems.Should().ContainSingle();
        result.MissingElisaSecondItems.Should().Contain("AntiTP");
    }

    [Fact]
    public async Task ValidateFullTestCoverageAsync_MissingNAT_ReturnsInvalid()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>();

        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        foreach (var item in elisaItems)
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaFirst,
                TestItem = item,
                Result = TestResult.Negative
            });
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.ElisaSecond,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        foreach (var item in natItems.Take(2))
        {
            tests.Add(new BloodTest
            {
                Id = Guid.NewGuid(),
                DonationId = donationId,
                TestType = TestType.NucleicAcidTest,
                TestItem = item,
                Result = TestResult.Negative
            });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.ValidateFullTestCoverageAsync(donationId);

        result.Should().NotBeNull();
        result.IsComplete.Should().BeFalse();
        result.MissingNatItems.Should().ContainSingle();
        result.MissingNatItems.Should().Contain("HBVRNA");
    }

    [Fact]
    public async Task IsDonationSafeAsync_WithAllTestsNegative_ReturnsTrue()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>();

        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        foreach (var item in elisaItems)
        {
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaFirst, TestItem = item, Result = TestResult.Negative });
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaSecond, TestItem = item, Result = TestResult.NonReactive });
        }

        foreach (var item in natItems)
        {
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.NucleicAcidTest, TestItem = item, Result = TestResult.Negative });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var donation = new Donation { Id = donationId, Status = DonationStatus.Completed };
        _unitOfWorkMock.Setup(u => u.Donations.GetByIdAsync(donationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donation);

        var result = await _bloodTestService.IsDonationSafeAsync(donationId);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsDonationSafeAsync_WithPositiveTest_ReturnsFalse()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>();

        var elisaItems = new[] { TestItem.HBsAg, TestItem.AntiHIV, TestItem.AntiHCV, TestItem.AntiTP };
        var natItems = new[] { TestItem.HIVRNA, TestItem.HCVRNA, TestItem.HBVRNA };

        foreach (var item in elisaItems)
        {
            var testResult = item == TestItem.HBsAg ? TestResult.Positive : TestResult.Negative;
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaFirst, TestItem = item, Result = testResult });
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaSecond, TestItem = item, Result = TestResult.Negative });
        }

        foreach (var item in natItems)
        {
            tests.Add(new BloodTest { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.NucleicAcidTest, TestItem = item, Result = TestResult.Negative });
        }

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.IsDonationSafeAsync(donationId);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task ReviewTestResultAsync_WithValidReviewer_UpdatesStatus()
    {
        var testId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var donationId = Guid.NewGuid();

        var test = new BloodTest
        {
            Id = testId,
            DonationId = donationId,
            TechnicianId = Guid.NewGuid(),
            TestType = TestType.ElisaFirst,
            TestItem = TestItem.HBsAg,
            Result = TestResult.Pending,
            IsReReviewed = false
        };

        var reviewer = new User
        {
            Id = reviewerId,
            Role = UserRole.Technician,
            FullName = "Reviewer Tech"
        };

        var otherTests = new List<BloodTest>
        {
            test,
            new() { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaSecond, TestItem = TestItem.HBsAg, Result = TestResult.Negative }
        };

        var donation = new Donation
        {
            Id = donationId,
            Status = DonationStatus.Completed
        };

        var expectedDto = new BloodTestDto(
            Id: testId,
            DonationId: donationId,
            DonationNumber: "DON001",
            TechnicianId: test.TechnicianId,
            TechnicianName: "Tech One",
            SecondReviewerId: reviewerId,
            SecondReviewerName: "Reviewer Tech",
            TestType: TestType.ElisaFirst,
            TestItem: TestItem.HBsAg,
            Result: TestResult.Negative,
            TestTime: DateTime.UtcNow,
            ReviewTime: DateTime.UtcNow,
            TestMethod: "ELISA",
            InstrumentUsed: "Instrument1",
            ReagentLot: "Lot123",
            QuantitativeResult: null,
            Unit: null,
            ReferenceRange: null,
            Notes: null,
            IsReReviewed: true,
            ReviewComment: "Approved");

        _unitOfWorkMock.Setup(u => u.BloodTests.GetByIdAsync(testId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(test);

        _unitOfWorkMock.Setup(u => u.Users.GetByIdAsync(reviewerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(reviewer);

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherTests);

        _unitOfWorkMock.Setup(u => u.Donations.GetByIdAsync(donationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donation);

        _mapperMock.Setup(m => m.Map<BloodTestDto>(test)).Returns(expectedDto);

        var result = await _bloodTestService.ReviewTestResultAsync(testId, reviewerId, TestResult.Negative, "Approved");

        result.Should().NotBeNull();
        result.IsReReviewed.Should().BeTrue();
        result.SecondReviewerId.Should().Be(reviewerId);
        result.Result.Should().Be(TestResult.Negative);
        _unitOfWorkMock.Verify(u => u.BloodTests.Update(It.Is<BloodTest>(t => t.Id == testId)), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task ReleaseDonationAsync_WithIncompleteTests_ThrowsValidationException()
    {
        var donationId = Guid.NewGuid();
        var tests = new List<BloodTest>
        {
            new() { Id = Guid.NewGuid(), DonationId = donationId, TestType = TestType.ElisaFirst, TestItem = TestItem.HBsAg, Result = TestResult.Negative }
        };

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        Func<Task> act = async () => await _bloodTestService.ReleaseDonationAsync(donationId);

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*incomplete*");
        _unitOfWorkMock.Verify(u => u.Donations.Update(It.IsAny<Donation>()), Times.Never);
    }

    [Fact]
    public async Task ReviewTestResultAsync_WithNonTechnicianReviewer_ThrowsForbiddenException()
    {
        var testId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();

        var test = new BloodTest
        {
            Id = testId,
            DonationId = Guid.NewGuid(),
            TechnicianId = Guid.NewGuid(),
            TestType = TestType.ElisaFirst,
            TestItem = TestItem.HBsAg
        };

        var reviewer = new User
        {
            Id = reviewerId,
            Role = UserRole.HospitalInterface,
            FullName = "Regular User"
        };

        _unitOfWorkMock.Setup(u => u.BloodTests.GetByIdAsync(testId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(test);

        _unitOfWorkMock.Setup(u => u.Users.GetByIdAsync(reviewerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(reviewer);

        Func<Task> act = async () => await _bloodTestService.ReviewTestResultAsync(testId, reviewerId, TestResult.Negative, "test");

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*technician*");
    }

    [Fact]
    public async Task GetTestsSummaryAsync_ReturnsCorrectSummary()
    {
        var startDate = DateTime.UtcNow.AddDays(-7);
        var endDate = DateTime.UtcNow;

        var tests = new List<BloodTest>
        {
            new() { Id = Guid.NewGuid(), TestItem = TestItem.HBsAg, TestType = TestType.ElisaFirst, Result = TestResult.Negative, TestTime = DateTime.UtcNow.AddDays(-2) },
            new() { Id = Guid.NewGuid(), TestItem = TestItem.AntiHIV, TestType = TestType.ElisaFirst, Result = TestResult.Positive, TestTime = DateTime.UtcNow.AddDays(-3) },
            new() { Id = Guid.NewGuid(), TestItem = TestItem.HCVRNA, TestType = TestType.NucleicAcidTest, Result = TestResult.Negative, TestTime = DateTime.UtcNow.AddDays(-1) },
            new() { Id = Guid.NewGuid(), TestItem = TestItem.HBsAg, TestType = TestType.ElisaSecond, Result = TestResult.Pending, TestTime = DateTime.UtcNow.AddDays(-1) },
            new() { Id = Guid.NewGuid(), TestItem = TestItem.AntiTP, TestType = TestType.ElisaFirst, Result = TestResult.Reactive, TestTime = DateTime.UtcNow.AddDays(-4) }
        };

        _unitOfWorkMock.Setup(u => u.BloodTests.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<BloodTest, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(tests);

        var result = await _bloodTestService.GetTestsSummaryAsync(startDate, endDate);

        result.Should().NotBeNull();
        result.TotalTests.Should().Be(5);
        result.PositiveTests.Should().Be(2);
        result.NegativeTests.Should().Be(2);
        result.PendingTests.Should().Be(1);
        result.PositiveRate.Should().Be(40);
        result.ByTestItem.Should().ContainKey(TestItem.HBsAg);
        result.ByTestType.Should().ContainKey(TestType.ElisaFirst);
    }
}
