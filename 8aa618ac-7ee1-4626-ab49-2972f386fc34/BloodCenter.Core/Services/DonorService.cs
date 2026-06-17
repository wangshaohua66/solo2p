using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Data.Repositories;
using BloodCenter.Infrastructure.Entities;
using BloodCenter.Infrastructure.Entities.Enums;
using BloodCenter.Infrastructure.Entities.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class DonorService : IDonorService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<DonorService> _logger;

    public DonorService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<DonorService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
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
        var queryable = _unitOfWork.Donors.Query().Where(d => !d.IsDeleted);

        if (!string.IsNullOrEmpty(query.Name))
        {
            queryable = queryable.Where(d =>
                d.FirstName.Contains(query.Name) || d.LastName.Contains(query.Name));
        }

        if (!string.IsNullOrEmpty(query.DonorNumber))
        {
            queryable = queryable.Where(d => d.DonorNumber.Contains(query.DonorNumber));
        }

        if (!string.IsNullOrEmpty(query.PhoneNumber))
        {
            queryable = queryable.Where(d => d.PhoneNumber.Contains(query.PhoneNumber));
        }

        if (!string.IsNullOrEmpty(query.IdCardNumber))
        {
            queryable = queryable.Where(d => d.IdCardNumber.Contains(query.IdCardNumber));
        }

        if (query.Status.HasValue)
        {
            queryable = queryable.Where(d => d.Status == query.Status.Value);
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .OrderByDescending(d => d.CreatedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

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

        var deferralReasons = new List<string>();
        var deferralDays = 0;
        var primaryDeferralReason = default(DeferralReason?);

        var age = DateTime.Today.Year - donor.DateOfBirth.Year;
        if (donor.DateOfBirth > DateTime.Today.AddYears(-age)) age--;

        if (age < 18 || age > 55)
        {
            deferralReasons.Add("Age outside eligible range (18-55 years)");
            primaryDeferralReason = DeferralReason.Other;
        }

        var timeSinceLastDonation = DateTime.UtcNow - donor.LastDonationDate;
        if (donor.LastDonationDate.HasValue && timeSinceLastDonation < TimeSpan.FromDays(56))
        {
            deferralReasons.Add("Less than 56 days since last donation");
            deferralDays = Math.Max(0, 56 - (int)timeSinceLastDonation.Value.TotalDays);
            primaryDeferralReason = DeferralReason.Other;
        }

        if (medicalHistory.HadRecentSurgery && medicalHistory.SurgeryDate.HasValue)
        {
            var timeSinceSurgery = DateTime.UtcNow - medicalHistory.SurgeryDate.Value;
            if (timeSinceSurgery < TimeSpan.FromDays(180))
            {
                deferralReasons.Add("Recent surgery within 6 months");
                primaryDeferralReason = DeferralReason.RecentSurgery;
                deferralDays = Math.Max(deferralDays, 180 - (int)timeSinceSurgery.TotalDays);
            }
        }

        if (medicalHistory.HasHepatitis || medicalHistory.HasHIV || medicalHistory.HasSyphilis || medicalHistory.HasMalaria)
        {
            deferralReasons.Add("History of infectious disease: hepatitis, HIV, syphilis, or malaria");
            primaryDeferralReason = DeferralReason.InfectiousDiseaseHistory;
            deferralDays = -1;
        }

        if (medicalHistory.HadBloodTransfusion && medicalHistory.TransfusionDate.HasValue)
        {
            var timeSinceTransfusion = DateTime.UtcNow - medicalHistory.TransfusionDate.Value;
            if (timeSinceTransfusion < TimeSpan.FromDays(365))
            {
                deferralReasons.Add("Recent blood transfusion within 12 months");
                primaryDeferralReason = DeferralReason.RecentBloodTransfusion;
                deferralDays = Math.Max(deferralDays, 365 - (int)timeSinceTransfusion.TotalDays);
            }
        }

        if (medicalHistory.IsPregnant)
        {
            deferralReasons.Add("Currently pregnant");
            primaryDeferralReason = DeferralReason.Pregnancy;
            deferralDays = 180;
        }

        if (medicalHistory.IsBreastfeeding)
        {
            deferralReasons.Add("Currently breastfeeding");
            primaryDeferralReason = DeferralReason.Breastfeeding;
            deferralDays = 90;
        }

        if (medicalHistory.HadTattoo && medicalHistory.TattooDate.HasValue)
        {
            var timeSinceTattoo = DateTime.UtcNow - medicalHistory.TattooDate.Value;
            if (timeSinceTattoo < TimeSpan.FromDays(180))
            {
                deferralReasons.Add("Recent tattoo within 6 months");
                primaryDeferralReason = DeferralReason.RecentTattoo;
                deferralDays = Math.Max(deferralDays, 180 - (int)timeSinceTattoo.TotalDays);
            }
        }

        if (medicalHistory.HadDentalWork && medicalHistory.DentalWorkDate.HasValue)
        {
            var timeSinceDentalWork = DateTime.UtcNow - medicalHistory.DentalWorkDate.Value;
            if (timeSinceDentalWork < TimeSpan.FromDays(7))
            {
                deferralReasons.Add("Recent dental work within 7 days");
                primaryDeferralReason = DeferralReason.RecentDentalWork;
                deferralDays = Math.Max(deferralDays, 7 - (int)timeSinceDentalWork.TotalDays);
            }
        }

        if (medicalHistory.TraveledToMalariaArea && medicalHistory.TravelDate.HasValue)
        {
            var timeSinceTravel = DateTime.UtcNow - medicalHistory.TravelDate.Value;
            if (timeSinceTravel < TimeSpan.FromDays(365))
            {
                deferralReasons.Add("Travel to malaria area within 12 months");
                primaryDeferralReason = DeferralReason.TravelToMalariaArea;
                deferralDays = Math.Max(deferralDays, 365 - (int)timeSinceTravel.TotalDays);
            }
        }

        if (medicalHistory.HadVaccination && medicalHistory.VaccinationDate.HasValue)
        {
            var timeSinceVaccination = DateTime.UtcNow - medicalHistory.VaccinationDate.Value;
            if (timeSinceVaccination < TimeSpan.FromDays(28))
            {
                deferralReasons.Add("Recent vaccination within 4 weeks");
                primaryDeferralReason = DeferralReason.RecentVaccination;
                deferralDays = Math.Max(deferralDays, 28 - (int)timeSinceVaccination.TotalDays);
            }
        }

        if (medicalHistory.HasHighBloodPressure)
        {
            deferralReasons.Add("High blood pressure");
            primaryDeferralReason = DeferralReason.HighBloodPressure;
        }

        if (medicalHistory.HasFever)
        {
            deferralReasons.Add("Current fever");
            primaryDeferralReason = DeferralReason.Fever;
            deferralDays = Math.Max(deferralDays, 14);
        }

        if (medicalHistory.HadDrugs)
        {
            deferralReasons.Add("History of drug use");
            primaryDeferralReason = DeferralReason.Other;
            deferralDays = -1;
        }

        var medicalHistoryRecord = _mapper.Map<DonorMedicalHistory>(medicalHistory);
        medicalHistoryRecord.DonorId = donorId;
        medicalHistoryRecord.EligibilityResult = deferralReasons.Count == 0;
        medicalHistoryRecord.DeferralReason = primaryDeferralReason.ToString();
        medicalHistoryRecord.DeferralDays = deferralDays > 0 ? deferralDays : null;

        await _unitOfWork.DonorMedicalHistories.AddAsync(medicalHistoryRecord, cancellationToken);

        DonorStatus status;
        DateTime? nextEligibleDate = null;

        if (deferralReasons.Count == 0)
        {
            status = DonorStatus.Eligible;
            nextEligibleDate = donor.LastDonationDate.HasValue
                ? donor.LastDonationDate.Value.AddDays(56)
                : DateTime.UtcNow;
        }
        else if (deferralDays == -1)
        {
            status = DonorStatus.PermanentlyDeferred;
        }
        else
        {
            status = DonorStatus.TemporarilyDeferred;
            nextEligibleDate = DateTime.UtcNow.AddDays(deferralDays);
        }

        donor.Status = status;
        donor.DeferralReason = primaryDeferralReason;
        donor.DeferralUntil = status == DonorStatus.TemporarilyDeferred ? nextEligibleDate : null;
        donor.NextEligibleDate = nextEligibleDate;

        _unitOfWork.Donors.Update(donor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new EligibilityCheckResult(
            deferralReasons.Count == 0,
            status,
            primaryDeferralReason,
            deferralDays > 0 ? deferralDays : null,
            nextEligibleDate,
            deferralReasons);
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
        var donors = await _unitOfWork.Donors.Query()
            .Where(d => !d.IsDeleted
                && d.Status == DonorStatus.Eligible
                && d.NextEligibleDate.HasValue
                && d.NextEligibleDate.Value <= recallDate)
            .OrderBy(d => d.NextEligibleDate)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<DonorDto>>(donors);
    }

    public async Task<IEnumerable<DonationRecordDto>> GetDonationHistoryAsync(Guid donorId, CancellationToken cancellationToken = default)
    {
        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken)
            ?? throw new NotFoundException("Donor", donorId);

        var donations = await _unitOfWork.Donations.Query()
            .Where(d => d.DonorId == donorId && !d.IsDeleted)
            .Include(d => d.CollectionSite)
            .Include(d => d.Nurse)
            .OrderByDescending(d => d.DonationDate)
            .ToListAsync(cancellationToken);

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
