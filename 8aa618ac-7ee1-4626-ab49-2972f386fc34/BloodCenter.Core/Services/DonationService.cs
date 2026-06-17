using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class DonationService : IDonationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<DonationService> _logger;
    private readonly IDeferralStrategy _deferralStrategy;

    public DonationService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<DonationService> logger, IDeferralStrategy deferralStrategy)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
        _deferralStrategy = deferralStrategy;
    }

    public async Task<DonationDto> CreateDonationAsync(CreateDonationDto donationDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Creating donation for donor {DonorId}", donationDto.DonorId);

        var donor = await _unitOfWork.Donors.GetByIdAsync(donationDto.DonorId, cancellationToken)
            ?? throw new NotFoundException("Donor", donationDto.DonorId);

        if (donor.Status != DonorStatus.Eligible)
        {
            throw new DonorDeferredException($"Donor is {donor.Status}", donor.DeferralUntil);
        }

        if (donor.NextEligibleDate > DateTime.UtcNow)
        {
            throw new DonorDeferredException($"Donor not eligible until {donor.NextEligibleDate}", donor.NextEligibleDate);
        }

        if (donationDto.Volume != 350 && donationDto.Volume != 400)
        {
            throw new ValidationException("Volume must be 350ml or 400ml");
        }

        var collectionSite = await _unitOfWork.CollectionSites.GetByIdAsync(donationDto.CollectionSiteId, cancellationToken)
            ?? throw new NotFoundException("CollectionSite", donationDto.CollectionSiteId);

        var nurse = await _unitOfWork.Users.GetByIdAsync(donationDto.NurseId, cancellationToken)
            ?? throw new NotFoundException("Nurse", donationDto.NurseId);

        if (nurse.Role != UserRole.Nurse)
        {
            throw new ValidationException("User is not a nurse");
        }

        var donation = _mapper.Map<Donation>(donationDto);
        donation.DonationNumber = await GenerateDonationNumber(cancellationToken);
        donation.Status = DonationStatus.InProgress;
        donation.BloodGroup = new ValueObjects.BloodGroup
        {
            ABO = donationDto.BloodType,
            Rh = donationDto.RhFactor
        };
        donation.CreatedAt = DateTime.UtcNow;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _unitOfWork.Donations.AddAsync(donation, cancellationToken);

            donor.LastDonationDate = donationDto.DonationDate;
            donor.NextEligibleDate = donationDto.DonationDate.AddDays(56);
            donor.TotalDonations++;
            donor.TotalVolumeDonated += donationDto.Volume;
            donor.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.Donors.Update(donor);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation("Donation created with number {DonationNumber}", donation.DonationNumber);
        return _mapper.Map<DonationDto>(donation);
    }

    public async Task<DonationDto?> GetDonationByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var donation = await _unitOfWork.Donations.Query()
            .Where(d => d.Id == id && !d.IsDeleted)
            .Include(d => d.Donor)
            .Include(d => d.CollectionSite)
            .Include(d => d.Nurse)
            .FirstOrDefaultAsync(cancellationToken);

        return donation == null ? null : _mapper.Map<DonationDto>(donation);
    }

    public async Task<DonationDto?> GetDonationByNumberAsync(string donationNumber, CancellationToken cancellationToken = default)
    {
        var donation = await _unitOfWork.Donations.Query()
            .Where(d => d.DonationNumber == donationNumber && !d.IsDeleted)
            .Include(d => d.Donor)
            .Include(d => d.CollectionSite)
            .Include(d => d.Nurse)
            .FirstOrDefaultAsync(cancellationToken);

        return donation == null ? null : _mapper.Map<DonationDto>(donation);
    }

    public async Task<PagedResult<DonationDto>> GetDonationsAsync(SearchDonationQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.Donations.Query()
            .Where(d => !d.IsDeleted)
            .Include(d => d.Donor)
            .Include(d => d.CollectionSite)
            .Include(d => d.Nurse);

        if (query.DonorId.HasValue)
        {
            queryable = queryable.Where(d => d.DonorId == query.DonorId.Value);
        }

        if (query.CollectionSiteId.HasValue)
        {
            queryable = queryable.Where(d => d.CollectionSiteId == query.CollectionSiteId.Value);
        }

        if (query.NurseId.HasValue)
        {
            queryable = queryable.Where(d => d.NurseId == query.NurseId.Value);
        }

        if (query.Status.HasValue)
        {
            queryable = queryable.Where(d => d.Status == query.Status.Value);
        }

        if (query.StartDate.HasValue)
        {
            queryable = queryable.Where(d => d.DonationDate >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            queryable = queryable.Where(d => d.DonationDate <= query.EndDate.Value);
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .OrderByDescending(d => d.DonationDate)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<DonationDto>(
            _mapper.Map<IEnumerable<DonationDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<InitialScreeningDto> RecordInitialScreeningAsync(Guid donationId, CreateInitialScreeningDto screeningDto, CancellationToken cancellationToken = default)
    {
        var donation = await _unitOfWork.Donations.GetByIdAsync(donationId, cancellationToken)
            ?? throw new NotFoundException("Donation", donationId);

        if (donation.Status != DonationStatus.InProgress && donation.Status != DonationStatus.Completed)
        {
            throw new InvalidOperationException($"Cannot record initial screening for donation in {donation.Status} status");
        }

        var technician = await _unitOfWork.Users.GetByIdAsync(screeningDto.TechnicianId, cancellationToken)
            ?? throw new NotFoundException("Technician", screeningDto.TechnicianId);

        if (technician.Role != UserRole.Technician)
        {
            throw new ValidationException("User is not a technician");
        }

        var screening = _mapper.Map<InitialScreening>(screeningDto);
        screening.DonationId = donationId;

        var deferralResult = await _deferralStrategy.EvaluateInitialScreeningAsync(
            (double)screeningDto.Hemoglobin,
            (double)screeningDto.ALT,
            screeningDto.HBsAg,
            cancellationToken);

        screening.Passed = deferralResult.IsEligible;
        screening.FailureReason = deferralResult.IsEligible ? null : string.Join("; ", deferralResult.DeferralReasons);
        screening.CreatedAt = DateTime.UtcNow;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _unitOfWork.InitialScreenings.AddAsync(screening, cancellationToken);

            donation.InitialScreeningPassed = screening.Passed;
            donation.InitialScreeningFailureReason = screening.FailureReason;

            if (screening.Passed)
            {
                donation.Status = DonationStatus.Completed;
            }
            else
            {
                donation.Status = DonationStatus.Rejected;
                var donor = await _unitOfWork.Donors.GetByIdAsync(donation.DonorId, cancellationToken);
                if (donor != null)
                {
                    if (deferralResult.DeferralDays == -1)
                    {
                        donor.Status = DonorStatus.PermanentlyDeferred;
                        donor.DeferralUntil = null;
                    }
                    else
                    {
                        donor.Status = DonorStatus.TemporarilyDeferred;
                        donor.DeferralUntil = deferralResult.DeferralDays.HasValue
                            ? DateTime.UtcNow.AddDays(deferralResult.DeferralDays.Value)
                            : null;
                    }
                    donor.DeferralReason = deferralResult.PrimaryReason;
                    _unitOfWork.Donors.Update(donor);
                }
            }

            donation.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Donations.Update(donation);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        if (!screening.Passed)
        {
            _logger.LogWarning("Initial screening failed for donation {DonationId}: {Reason}", donationId, screening.FailureReason);
        }

        return _mapper.Map<InitialScreeningDto>(screening);
    }

    public async Task<DonationDto> UpdateDonationStatusAsync(Guid id, DonationStatus status, string? notes, CancellationToken cancellationToken = default)
    {
        var donation = await _unitOfWork.Donations.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Donation", id);

        donation.Status = status;
        if (!string.IsNullOrEmpty(notes))
        {
            donation.Notes = string.IsNullOrEmpty(donation.Notes) ? notes : $"{donation.Notes}; {notes}";
        }
        donation.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Donations.Update(donation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<DonationDto>(donation);
    }

    public async Task<IEnumerable<DonationDto>> GetDonationsByDonorAsync(Guid donorId, CancellationToken cancellationToken = default)
    {
        var donations = await _unitOfWork.Donations.Query()
            .Where(d => d.DonorId == donorId && !d.IsDeleted)
            .Include(d => d.CollectionSite)
            .Include(d => d.Nurse)
            .OrderByDescending(d => d.DonationDate)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<DonationDto>>(donations);
    }

    public async Task<DonationStatsDto> GetDonationStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var donations = await _unitOfWork.Donations.Query()
            .Where(d => d.DonationDate >= startDate && d.DonationDate <= endDate && !d.IsDeleted)
            .Include(d => d.Donor)
            .ToListAsync(cancellationToken);

        var stats = new DonationStatsDto(
            TotalDonations: donations.Count,
            SuccessfulDonations: donations.Count(d => d.Status == DonationStatus.Completed || d.Status == DonationStatus.Released),
            DeferredDonations: donations.Count(d => d.Status == DonationStatus.Deferred || d.Status == DonationStatus.Rejected),
            TotalVolume: donations.Sum(d => d.Volume),
            AverageVolume: donations.Any() ? Math.Round(donations.Average(d => d.Volume), 2) : 0,
            ByBloodType: donations.GroupBy(d => d.BloodGroup.ToString())
                .ToDictionary(g => g.Key, g => g.Count()),
            BySite: donations.GroupBy(d => d.CollectionSiteId)
                .ToDictionary(g => g.Key, g => g.Count()),
            ByDay: donations.GroupBy(d => d.DonationDate.Date.ToString("yyyy-MM-dd"))
                .ToDictionary(g => g.Key, g => g.Count())
        );

        return stats;
    }

    public async Task DeleteDonationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var donation = await _unitOfWork.Donations.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Donation", id);

        var hasProducts = await _unitOfWork.BloodProducts.ExistsAsync(
            bp => bp.DonationId == id && !bp.IsDeleted, cancellationToken);

        if (hasProducts)
        {
            throw new InvalidOperationException("Cannot delete donation with existing blood products");
        }

        _unitOfWork.Donations.Delete(donation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateDonationNumber(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year.ToString("D4");
        var month = DateTime.UtcNow.Month.ToString("D2");
        var count = await _unitOfWork.Donations.CountAsync(
            d => d.CreatedAt.Year == DateTime.UtcNow.Year &&
                 d.CreatedAt.Month == DateTime.UtcNow.Month &&
                 !d.IsDeleted,
            cancellationToken);
        return $"DO{year}{month}{(count + 1).ToString("D6")}";
    }
}
