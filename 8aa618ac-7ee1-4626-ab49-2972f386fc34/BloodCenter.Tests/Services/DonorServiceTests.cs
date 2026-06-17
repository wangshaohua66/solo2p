using AutoMapper;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Services;
using Microsoft.Extensions.Logging;
using BcInvalidOperationException = BloodCenter.Core.Exceptions.InvalidOperationException;

namespace BloodCenter.Tests.Services;

public class DonorServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IMapper> _mapperMock;
    private readonly Mock<ILogger<DonorService>> _loggerMock;
    private readonly Mock<IDeferralStrategy> _deferralStrategyMock;
    private readonly DonorService _donorService;

    public DonorServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _mapperMock = new Mock<IMapper>();
        _loggerMock = new Mock<ILogger<DonorService>>();
        _deferralStrategyMock = new Mock<IDeferralStrategy>();
        _donorService = new DonorService(_unitOfWorkMock.Object, _mapperMock.Object, _loggerMock.Object, _deferralStrategyMock.Object);
    }

    [Fact]
    public async Task RegisterDonorAsync_WithValidData_CreatesDonor()
    {
        var donorDto = new CreateDonorDto(
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: new AddressDto("Main St", "City", "Province", "12345"),
            Occupation: "Engineer",
            IsVolunteer: true);

        var donor = new Donor
        {
            Id = Guid.NewGuid(),
            FirstName = "John",
            LastName = "Doe",
            IdCardNumber = "123456789",
            PhoneNumber = "1234567890",
            Status = DonorStatus.Eligible,
            CreatedAt = DateTime.UtcNow
        };

        var expectedResult = new DonorDto(
            Id: donor.Id,
            DonorNumber: "D2024000001",
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: new AddressDto("Main St", "City", "Province", "12345"),
            BloodGroupDisplay: "Unknown",
            BloodType: null,
            RhFactor: null,
            Status: DonorStatus.Eligible,
            DeferralReason: null,
            DeferralUntil: null,
            LastDonationDate: null,
            NextEligibleDate: null,
            TotalDonations: 0,
            TotalVolumeDonated: 0,
            IsVolunteer: true,
            Occupation: "Engineer",
            CreatedAt: DateTime.UtcNow);

        _unitOfWorkMock.Setup(u => u.Donors.ExistsAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _unitOfWorkMock.Setup(u => u.Donors.CountAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _mapperMock.Setup(m => m.Map<Donor>(donorDto)).Returns(donor);
        _mapperMock.Setup(m => m.Map<DonorDto>(donor)).Returns(expectedResult);

        var result = await _donorService.RegisterDonorAsync(donorDto);

        result.Should().NotBeNull();
        result.FirstName.Should().Be("John");
        result.LastName.Should().Be("Doe");
        result.Status.Should().Be(DonorStatus.Eligible);
        _unitOfWorkMock.Verify(u => u.Donors.AddAsync(It.Is<Donor>(d => d.FirstName == "John"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDonorAsync_WithDuplicateIdCard_ThrowsAlreadyExistsException()
    {
        var donorDto = new CreateDonorDto(
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: null,
            Occupation: "Engineer",
            IsVolunteer: true);

        _unitOfWorkMock.Setup(u => u.Donors.ExistsAsync(
            It.Is<System.Linq.Expressions.Expression<Func<Donor, bool>>>(e => e.ToString()!.Contains("IdCardNumber")),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        Func<Task> act = async () => await _donorService.RegisterDonorAsync(donorDto);

        await act.Should().ThrowAsync<AlreadyExistsException>()
            .WithMessage("*Donor*IdCardNumber*");
        _unitOfWorkMock.Verify(u => u.Donors.AddAsync(It.IsAny<Donor>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetDonorByIdAsync_WhenExists_ReturnsDonor()
    {
        var donorId = Guid.NewGuid();
        var donor = new Donor
        {
            Id = donorId,
            FirstName = "Jane",
            LastName = "Smith",
            IdCardNumber = "987654321",
            PhoneNumber = "0987654321",
            Status = DonorStatus.Eligible
        };

        var expectedDto = new DonorDto(
            Id: donorId,
            DonorNumber: "D2024000001",
            FirstName: "Jane",
            LastName: "Smith",
            DateOfBirth: new DateTime(1985, 5, 15),
            Gender: "Female",
            IdCardNumber: "987654321",
            PhoneNumber: "0987654321",
            Email: "jane@example.com",
            Address: null,
            BloodGroupDisplay: "O+",
            BloodType: BloodType.O,
            RhFactor: RhFactor.Positive,
            Status: DonorStatus.Eligible,
            DeferralReason: null,
            DeferralUntil: null,
            LastDonationDate: null,
            NextEligibleDate: null,
            TotalDonations: 5,
            TotalVolumeDonated: 2000,
            IsVolunteer: true,
            Occupation: "Teacher",
            CreatedAt: DateTime.UtcNow.AddMonths(-6));

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donor);
        _mapperMock.Setup(m => m.Map<DonorDto>(donor)).Returns(expectedDto);

        var result = await _donorService.GetDonorByIdAsync(donorId);

        result.Should().NotBeNull();
        result!.Id.Should().Be(donorId);
        result.FirstName.Should().Be("Jane");
        result.LastName.Should().Be("Smith");
    }

    [Fact]
    public async Task GetDonorByIdAsync_WhenNotExists_ReturnsNull()
    {
        var donorId = Guid.NewGuid();

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Donor?)null);

        var result = await _donorService.GetDonorByIdAsync(donorId);

        result.Should().BeNull();
    }

    [Fact]
    public async Task SearchDonorsAsync_WithFilters_ReturnsMatchingDonors()
    {
        var query = new SearchDonorQuery(
            Name: "John",
            DonorNumber: null,
            PhoneNumber: null,
            IdCardNumber: null,
            Status: null,
            PageNumber: 1,
            PageSize: 10);

        var donors = new List<Donor>
        {
            new() { Id = Guid.NewGuid(), FirstName = "John", LastName = "Doe", Status = DonorStatus.Eligible, CreatedAt = DateTime.UtcNow, IsDeleted = false },
            new() { Id = Guid.NewGuid(), FirstName = "Johnny", LastName = "Smith", Status = DonorStatus.Eligible, CreatedAt = DateTime.UtcNow.AddDays(-1), IsDeleted = false }
        };

        var donorDtos = new List<DonorDto>
        {
            new(Guid.NewGuid(), "D2024000001", "John", "Doe", new DateTime(1990,1,1), "Male", "111", "222", null, null, "O+", BloodType.O, RhFactor.Positive, DonorStatus.Eligible, null, null, null, null, 0, 0, true, null, DateTime.UtcNow),
            new(Guid.NewGuid(), "D2024000002", "Johnny", "Smith", new DateTime(1985,1,1), "Male", "333", "444", null, null, "A+", BloodType.A, RhFactor.Positive, DonorStatus.Eligible, null, null, null, null, 0, 0, true, null, DateTime.UtcNow.AddDays(-1))
        };

        _unitOfWorkMock.Setup(u => u.Donors.FindAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(donors);
        _mapperMock.Setup(m => m.Map<IEnumerable<DonorDto>>(It.IsAny<IEnumerable<Donor>>()))
            .Returns(donorDtos);

        var result = await _donorService.SearchDonorsAsync(query);

        result.Should().NotBeNull();
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.PageNumber.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task UpdateDonorAsync_UpdatesExistingDonor()
    {
        var donorId = Guid.NewGuid();
        var updateDto = new UpdateDonorDto(
            FirstName: "John Updated",
            LastName: "Doe Updated",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            PhoneNumber: "9999999999",
            Email: "updated@example.com",
            Address: new AddressDto("New St", "New City", "New Province", "99999"),
            Occupation: "Senior Engineer");

        var existingDonor = new Donor
        {
            Id = donorId,
            FirstName = "John",
            LastName = "Doe",
            PhoneNumber = "1234567890",
            IdCardNumber = "123456789",
            Status = DonorStatus.Eligible
        };

        var updatedDto = new DonorDto(
            Id: donorId,
            DonorNumber: "D2024000001",
            FirstName: "John Updated",
            LastName: "Doe Updated",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "9999999999",
            Email: "updated@example.com",
            Address: new AddressDto("New St", "New City", "New Province", "99999"),
            BloodGroupDisplay: "O+",
            BloodType: BloodType.O,
            RhFactor: RhFactor.Positive,
            Status: DonorStatus.Eligible,
            DeferralReason: null,
            DeferralUntil: null,
            LastDonationDate: null,
            NextEligibleDate: null,
            TotalDonations: 0,
            TotalVolumeDonated: 0,
            IsVolunteer: true,
            Occupation: "Senior Engineer",
            CreatedAt: DateTime.UtcNow);

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingDonor);

        _unitOfWorkMock.Setup(u => u.Donors.ExistsAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mapperMock.Setup(m => m.Map(updateDto, existingDonor));
        _mapperMock.Setup(m => m.Map<DonorDto>(existingDonor)).Returns(updatedDto);

        var result = await _donorService.UpdateDonorAsync(donorId, updateDto);

        result.Should().NotBeNull();
        result.FirstName.Should().Be("John Updated");
        result.PhoneNumber.Should().Be("9999999999");
        _unitOfWorkMock.Verify(u => u.Donors.Update(It.Is<Donor>(d => d.Id == donorId)), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateDonorAsync_WhenDonorNotFound_ThrowsNotFoundException()
    {
        var donorId = Guid.NewGuid();
        var updateDto = new UpdateDonorDto(
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: null,
            Occupation: "Engineer");

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Donor?)null);

        Func<Task> act = async () => await _donorService.UpdateDonorAsync(donorId, updateDto);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Donor*");
    }

    [Fact]
    public async Task DeleteDonorAsync_WithNoDonations_DeletesDonor()
    {
        var donorId = Guid.NewGuid();
        var donor = new Donor
        {
            Id = donorId,
            FirstName = "John",
            LastName = "Doe",
            Status = DonorStatus.Eligible
        };

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donor);

        _unitOfWorkMock.Setup(u => u.Donations.ExistsAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donation, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        await _donorService.DeleteDonorAsync(donorId);

        _unitOfWorkMock.Verify(u => u.Donors.Delete(It.Is<Donor>(d => d.Id == donorId)), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteDonorAsync_WithExistingDonations_ThrowsInvalidOperationException()
    {
        var donorId = Guid.NewGuid();
        var donor = new Donor
        {
            Id = donorId,
            FirstName = "John",
            LastName = "Doe",
            Status = DonorStatus.Eligible
        };

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donor);

        _unitOfWorkMock.Setup(u => u.Donations.ExistsAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donation, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        Func<Task> act = async () => await _donorService.DeleteDonorAsync(donorId);

        await act.Should().ThrowAsync<BcInvalidOperationException>()
            .WithMessage("*existing donation records*");
        _unitOfWorkMock.Verify(u => u.Donors.Delete(It.IsAny<Donor>()), Times.Never);
    }

    [Fact]
    public async Task GetDonorByNumberAsync_WhenExists_ReturnsDonor()
    {
        const string donorNumber = "D2024000001";
        var donor = new Donor
        {
            Id = Guid.NewGuid(),
            DonorNumber = donorNumber,
            FirstName = "John",
            LastName = "Doe",
            Status = DonorStatus.Eligible
        };

        var expectedDto = new DonorDto(
            Id: donor.Id,
            DonorNumber: donorNumber,
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: null,
            BloodGroupDisplay: "O+",
            BloodType: BloodType.O,
            RhFactor: RhFactor.Positive,
            Status: DonorStatus.Eligible,
            DeferralReason: null,
            DeferralUntil: null,
            LastDonationDate: null,
            NextEligibleDate: null,
            TotalDonations: 0,
            TotalVolumeDonated: 0,
            IsVolunteer: true,
            Occupation: "Engineer",
            CreatedAt: DateTime.UtcNow);

        _unitOfWorkMock.Setup(u => u.Donors.FirstOrDefaultAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(donor);

        _mapperMock.Setup(m => m.Map<DonorDto>(donor)).Returns(expectedDto);

        var result = await _donorService.GetDonorByNumberAsync(donorNumber);

        result.Should().NotBeNull();
        result!.DonorNumber.Should().Be(donorNumber);
    }

    [Fact]
    public async Task CheckEligibilityAsync_WithUnderAgeDonor_ReturnsDeferred()
    {
        var donorId = Guid.NewGuid();
        var donor = new Donor
        {
            Id = donorId,
            FirstName = "Young",
            LastName = "Person",
            DateOfBirth = DateTime.Today.AddYears(-16),
            Status = DonorStatus.Eligible
        };

        var medicalHistory = new MedicalHistoryDto(
            HadRecentSurgery: false,
            SurgeryDate: null,
            HadBloodTransfusion: false,
            TransfusionDate: null,
            HasHepatitis: false,
            HasHIV: false,
            HasSyphilis: false,
            HasMalaria: false,
            HasHeartDisease: false,
            HasHighBloodPressure: false,
            HasDiabetes: false,
            HasCancer: false,
            HadVaccination: false,
            VaccinationDate: null,
            VaccinationType: null,
            HadTattoo: false,
            TattooDate: null,
            HadDentalWork: false,
            DentalWorkDate: null,
            TraveledToMalariaArea: false,
            TravelDate: null,
            IsPregnant: false,
            IsBreastfeeding: false,
            LastMenstrualDate: null,
            HasFever: false,
            TakingMedication: false,
            MedicationDetails: null,
            HadAlcohol: false,
            HadTobacco: false,
            HadDrugs: false,
            AdditionalNotes: null);

        var medicalHistoryRecord = new DonorMedicalHistory
        {
            Id = Guid.NewGuid(),
            DonorId = donorId,
            EligibilityResult = false
        };

        _unitOfWorkMock.Setup(u => u.Donors.GetByIdAsync(donorId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(donor);

        _mapperMock.Setup(m => m.Map<DonorMedicalHistory>(medicalHistory))
            .Returns(medicalHistoryRecord);

        var result = await _donorService.CheckEligibilityAsync(donorId, medicalHistory);

        result.Should().NotBeNull();
        result.IsEligible.Should().BeFalse();
        result.Status.Should().Be(DonorStatus.TemporarilyDeferred);
        result.DeferralReasons.Should().Contain(r => r.Contains("Age"));
    }

    [Fact]
    public async Task RegisterDonorAsync_WithDuplicatePhoneNumber_ThrowsAlreadyExistsException()
    {
        var donorDto = new CreateDonorDto(
            FirstName: "John",
            LastName: "Doe",
            DateOfBirth: new DateTime(1990, 1, 1),
            Gender: "Male",
            IdCardNumber: "123456789",
            PhoneNumber: "1234567890",
            Email: "john@example.com",
            Address: null,
            Occupation: "Engineer",
            IsVolunteer: true);

        _unitOfWorkMock.SetupSequence(u => u.Donors.ExistsAsync(
            It.IsAny<System.Linq.Expressions.Expression<Func<Donor, bool>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(false)
            .ReturnsAsync(true);

        Func<Task> act = async () => await _donorService.RegisterDonorAsync(donorDto);

        await act.Should().ThrowAsync<AlreadyExistsException>()
            .WithMessage("*Donor*PhoneNumber*");
    }
}
