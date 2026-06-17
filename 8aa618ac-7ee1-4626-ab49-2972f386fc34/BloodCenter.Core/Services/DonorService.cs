using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class DonorService : IDonorService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<DonorService> _logger;
    private readonly IDeferralStrategy _deferralStrategy;

    public DonorService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<DonorService> logger, IDeferralStrategy deferralStrategy)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
        _deferralStrategy = deferralStrategy;
    }

    public async Task<DonorDto> RegisterDonorAsync(CreateDonorDto donorDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Registering new donor: {FirstName} {LastName}", donorDto.FirstName, donorDto.LastName);

        if (await _unitOfWork.Donors.ExistsAsync(d => d.IdCardNumber == donorDto.IdCardNumber && !d.IsDeleted, cancellationToken))
        {
            throw new AlreadyExistsException("Donor", "IdCardNumber", donorDto.IdCardNumber);
        }

        if (await _unitOfWork.Donors.ExistsAsync(d => d.PhoneNumber == donorDto.PhoneNumber && !d.IsDeleted, cancellationToken))
        {
            throw new AlreadyExistsException("Donor", "PhoneNumber", donorDto.PhoneNumber);
        }

        var donor = _mapper.Map<Donor>(donorDto);
        donor.DonorNumber = await GenerateDonorNumber(cancellationToken);
        donor.Status = DonorStatus.Eligible;
        donor.CreatedAt = DateTime.UtcNow;

        await _unitOfWork.Donors.AddAsync(donor, cancellationToken);
        _logger.LogInformation("Donor registered with ID: {DonorId}", donor.Id);

        return _mapper.Map<DonorDto>(donor);
    }

    public async Task<DonorDto> UpdateDonorAsync(Guid id, UpdateDonorDto donorDto, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Donor", id);

        if (await _unitOfWork.Donors.ExistsAsync(
            d => d.PhoneNumber == donorDto.PhoneNumber && d.Id != id && !d.IsDeleted, cancellationToken))
        {
            throw new AlreadyExistsException("Donor", "PhoneNumber", donorDto.PhoneNumber);
        }

        _mapper.Map(donorDto, donor);
        donor.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Donors.Update(donor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<DonorDto>(donor);
    }

    public async Task<DonorDto?> GetDonorByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(id, cancellationToken);
        return donor == null ? null : _mapper.Map<DonorDto>(donor);
    }

    public async Task<DonorDto?> GetDonorByNumberAsync(string donorNumber, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.FirstOrDefaultAsync(
            d => d.DonorNumber == donorNumber && !d.IsDeleted, cancellationToken);
        return donor == null ? null : _mapper.Map<DonorDto>(donor);
    }

    public async Task<PagedResult<DonorDto>> SearchDonorsAsync(SearchDonorQuery query, CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await _unitOfWork.Donors.GetPagedAsync(
            query.PageNumber,
            query.PageSize,
            d => !d.IsDeleted
                && (string.IsNullOrEmpty(query.Name) || d.FirstName.Contains(query.Name) || d.LastName.Contains(query.Name))
                && (string.IsNullOrEmpty(query.DonorNumber) || d.DonorNumber.Contains(query.DonorNumber))
                && (string.IsNullOrEmpty(query.PhoneNumber) || d.PhoneNumber.Contains(query.PhoneNumber))
                && (string.IsNullOrEmpty(query.IdCardNumber) || d.IdCardNumber.Contains(query.IdCardNumber))
                && (!query.Status.HasValue || d.Status == query.Status.Value),
            d => d.CreatedAt,
            true,
            null,
            true,
            null,
            cancellationToken);

        return new PagedResult<DonorDto>(
            _mapper.Map<IEnumerable<DonorDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<EligibilityCheckResult> CheckEligibilityAsync(Guid donorId, MedicalHistoryDto medicalHistory, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken)
            ?? throw new NotFoundException("Donor", donorId);

        var historyFlags = new MedicalHistoryFlags(
            HadRecentSurgery: medicalHistory.HadRecentSurgery,
            SurgeryDate: medicalHistory.SurgeryDate,
            HasHepatitis: medicalHistory.HasHepatitis,
            HasHIV: medicalHistory.HasHIV,
            HasSyphilis: medicalHistory.HasSyphilis,
            HasMalaria: medicalHistory.HasMalaria,
            HadBloodTransfusion: medicalHistory.HadBloodTransfusion,
            TransfusionDate: medicalHistory.TransfusionDate,
            IsPregnant: medicalHistory.IsPregnant,
            IsBreastfeeding: medicalHistory.IsBreastfeeding,
            HadTattoo: medicalHistory.HadTattoo,
            TattooDate: medicalHistory.TattooDate,
            HadDentalWork: medicalHistory.HadDentalWork,
            DentalWorkDate: medicalHistory.DentalWorkDate,
            TraveledToMalariaArea: medicalHistory.TraveledToMalariaArea,
            TravelDate: medicalHistory.TravelDate,
            HadVaccination: medicalHistory.HadVaccination,
            VaccinationDate: medicalHistory.VaccinationDate,
            HasHighBloodPressure: medicalHistory.HasHighBloodPressure,
            HasFever: medicalHistory.HasFever,
            HadDrugs: medicalHistory.HadDrugs);

        var deferralResult = await _deferralStrategy.EvaluateMedicalHistoryAsync(
            historyFlags,
            donor.LastDonationDate,
            donor.DateOfBirth,
            cancellationToken);

        var medicalHistoryRecord = _mapper.Map<DonorMedicalHistory>(medicalHistory);
        medicalHistoryRecord.DonorId = donorId;
        medicalHistoryRecord.EligibilityResult = deferralResult.IsEligible;
        medicalHistoryRecord.DeferralReason = deferralResult.PrimaryReason.ToString();
        medicalHistoryRecord.DeferralDays = deferralResult.DeferralDays > 0 ? deferralResult.DeferralDays : null;

        await _unitOfWork.DonorMedicalHistories.AddAsync(medicalHistoryRecord, cancellationToken);

        DonorStatus status;
        DateTime? nextEligibleDate = null;

        if (deferralResult.IsEligible)
        {
            status = DonorStatus.Eligible;
            nextEligibleDate = donor.LastDonationDate.HasValue
                ? donor.LastDonationDate.Value.AddDays(56)
                : DateTime.UtcNow;
        }
        else if (deferralResult.DeferralDays == -1)
        {
            status = DonorStatus.PermanentlyDeferred;
        }
        else
        {
            status = DonorStatus.TemporarilyDeferred;
            nextEligibleDate = deferralResult.DeferralDays.HasValue
                ? DateTime.UtcNow.AddDays(deferralResult.DeferralDays.Value)
                : null;
        }

        donor.Status = status;
        donor.DeferralReason = deferralResult.PrimaryReason;
        donor.DeferralUntil = status == DonorStatus.TemporarilyDeferred ? nextEligibleDate : null;
        donor.NextEligibleDate = nextEligibleDate;

        _unitOfWork.Donors.Update(donor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new EligibilityCheckResult(
            deferralResult.IsEligible,
            status,
            deferralResult.PrimaryReason,
            deferralResult.DeferralDays > 0 ? deferralResult.DeferralDays : null,
            nextEligibleDate,
            deferralResult.DeferralReasons);
    }

    public async Task<DonorDto> UpdateDonorStatusAsync(Guid id, DonorStatus status, DeferralReason? reason, DateTime? deferralUntil, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Donor", id);

        donor.Status = status;
        donor.DeferralReason = reason;
        donor.DeferralUntil = deferralUntil;
        donor.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Donors.Update(donor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<DonorDto>(donor);
    }

    public async Task<DateTime> CalculateNextEligibleDateAsync(Guid donorId, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken)
            ?? throw new NotFoundException("Donor", donorId);

        if (donor.Status == DonorStatus.PermanentlyDeferred)
        {
            throw new DonorDeferredException("Donor is permanently deferred", null);
        }

        if (donor.DeferralUntil.HasValue && donor.DeferralUntil > DateTime.UtcNow)
        {
            return donor.DeferralUntil.Value;
        }

        var nextDate = donor.LastDonationDate.HasValue
            ? donor.LastDonationDate.Value.AddDays(56)
            : DateTime.UtcNow;

        return nextDate;
    }

    public async Task<IEnumerable<DonorDto>> GetDonorsForRecallAsync(int daysBefore, CancellationToken cancellationToken = default)
    {
        var recallDate = DateTime.UtcNow.AddDays(daysBefore);
        var donors = await _unitOfWork.Donors.FindAsync(
            d => !d.IsDeleted
                && d.Status == DonorStatus.Eligible
                && d.NextEligibleDate.HasValue
                && d.NextEligibleDate.Value <= recallDate,
            d => d.NextEligibleDate,
            false,
            null,
            cancellationToken);

        return _mapper.Map<IEnumerable<DonorDto>>(donors);
    }

    public async Task<IEnumerable<DonationRecordDto>> GetDonationHistoryAsync(Guid donorId, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken)
            ?? throw new NotFoundException("Donor", donorId);

        var donations = await _unitOfWork.Donations.FindAsync(
            d => d.DonorId == donorId && !d.IsDeleted,
            d => d.DonationDate,
            true,
            new[] { "CollectionSite", "Nurse" },
            cancellationToken);

        return _mapper.Map<IEnumerable<DonationRecordDto>>(donations);
    }

    public async Task DeleteDonorAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Donor", id);

        var hasDonations = await _unitOfWork.Donations.ExistsAsync(d => d.DonorId == id && !d.IsDeleted, cancellationToken);
        if (hasDonations)
        {
            throw new InvalidOperationException("Cannot delete donor with existing donation records");
        }

        _unitOfWork.Donors.Delete(donor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateDonorNumber(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year.ToString("D4");
        var count = await _unitOfWork.Donors.CountAsync(
            d => d.CreatedAt.Year == DateTime.UtcNow.Year && !d.IsDeleted,
            cancellationToken);
        return $"D{year}{(count + 1).ToString("D6")}";
    }
}
