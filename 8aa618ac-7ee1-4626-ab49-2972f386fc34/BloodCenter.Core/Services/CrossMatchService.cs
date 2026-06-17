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

public class CrossMatchService : ICrossMatchService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<CrossMatchService> _logger;

    public CrossMatchService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<CrossMatchService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<BloodRequestDto> CreateBloodRequestAsync(CreateBloodRequestDto requestDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Creating blood request from hospital {HospitalId}", requestDto.HospitalId);

        var hospital = await _unitOfWork.Hospitals.GetByIdAsync(requestDto.HospitalId, cancellationToken)
            ?? throw new NotFoundException("Hospital", requestDto.HospitalId);

        if (!hospital.IsActive)
        {
            throw new InvalidOperationException("Hospital is not active");
        }

        if (requestDto.QuantityRequested <= 0)
        {
            throw new ValidationException("Quantity requested must be greater than 0");
        }

        var request = _mapper.Map<BloodRequest>(requestDto);
        request.RequestNumber = await GenerateRequestNumber(cancellationToken);
        request.PatientBloodGroup = new BloodGroup
        {
            ABO = requestDto.PatientBloodType,
            Rh = requestDto.PatientRhFactor
        };
        request.Status = "Pending";
        request.CreatedAt = DateTime.UtcNow;

        await _unitOfWork.BloodRequests.AddAsync(request, cancellationToken);

        _logger.LogInformation("Blood request created: {RequestNumber}", request.RequestNumber);
        return _mapper.Map<BloodRequestDto>(request);
    }

    public async Task<BloodRequestDto?> GetRequestByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.Id == id && !r.IsDeleted)
            .Include(r => r.Hospital)
            .Include(r => r.CrossMatches)
            .FirstOrDefaultAsync(cancellationToken);

        return request == null ? null : _mapper.Map<BloodRequestDto>(request);
    }

    public async Task<BloodRequestDto?> GetRequestByNumberAsync(string requestNumber, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.RequestNumber == requestNumber && !r.IsDeleted)
            .Include(r => r.Hospital)
            .Include(r => r.CrossMatches)
            .FirstOrDefaultAsync(cancellationToken);

        return request == null ? null : _mapper.Map<BloodRequestDto>(request);
    }

    public async Task<PagedResult<BloodRequestDto>> GetRequestsAsync(SearchBloodRequestQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.BloodRequests.Query()
            .Where(r => !r.IsDeleted)
            .Include(r => r.Hospital)
            .Include(r => r.CrossMatches);

        if (query.HospitalId.HasValue)
        {
            queryable = queryable.Where(r => r.HospitalId == query.HospitalId.Value);
        }

        if (!string.IsNullOrEmpty(query.PatientId))
        {
            queryable = queryable.Where(r => r.PatientId.Contains(query.PatientId));
        }

        if (query.ProductType.HasValue)
        {
            queryable = queryable.Where(r => r.ProductType == query.ProductType.Value);
        }

        if (query.Urgency.HasValue)
        {
            queryable = queryable.Where(r => r.Urgency == query.Urgency.Value);
        }

        if (!string.IsNullOrEmpty(query.Status))
        {
            queryable = queryable.Where(r => r.Status == query.Status);
        }

        if (query.StartDate.HasValue)
        {
            queryable = queryable.Where(r => r.CreatedAt >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            queryable = queryable.Where(r => r.CreatedAt <= query.EndDate.Value);
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .OrderByDescending(r => r.Urgency)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<BloodRequestDto>(
            _mapper.Map<IEnumerable<BloodRequestDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IEnumerable<BloodRequestDto>> GetRequestsByHospitalAsync(Guid hospitalId, CancellationToken cancellationToken = default)
    {
        var requests = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.HospitalId == hospitalId && !r.IsDeleted)
            .Include(r => r.Hospital)
            .Include(r => r.CrossMatches)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<BloodRequestDto>>(requests);
    }

    public async Task<IEnumerable<CrossMatchResultDto>> PerformCrossMatchAsync(Guid requestId, Guid technicianId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Performing cross match for request {RequestId}", requestId);

        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.Id == requestId && !r.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodRequest", requestId);

        var technician = await _unitOfWork.Users.GetByIdAsync(technicianId, cancellationToken)
            ?? throw new NotFoundException("Technician", technicianId);

        if (technician.Role != UserRole.Technician && technician.Role != UserRole.Administrator)
        {
            throw new ForbiddenException("Only technicians can perform cross matching");
        }

        var compatibleProducts = await FindCompatibleProductsAsync(requestId, cancellationToken);
        var results = new List<CrossMatchResultDto>();

        var needed = request.QuantityRequested - request.QuantityIssued;
        var productsToMatch = compatibleProducts
            .OrderBy(p => request.Urgency == UrgencyLevel.Emergency ? p.DaysUntilExpiry : 0)
            .ThenBy(p => p.ExpiryDate)
            .Take(needed)
            .ToList();

        foreach (var product in productsToMatch)
        {
            var bloodProduct = await _unitOfWork.BloodProducts.GetByIdAsync(product.ProductId, cancellationToken);
            if (bloodProduct == null) continue;

            var patientBloodGroup = new BloodGroup
            {
                ABO = request.PatientBloodGroup.ABO,
                Rh = request.PatientBloodGroup.Rh
            };

            var majorSideCompatible = bloodProduct.BloodGroup.IsCompatibleWith(patientBloodGroup);
            var minorSideCompatible = patientBloodGroup.IsCompatibleWith(bloodProduct.BloodGroup);

            var overallResult = (majorSideCompatible, minorSideCompatible) switch
            {
                (true, true) => CrossMatchResult.Compatible,
                (false, _) => CrossMatchResult.Incompatible,
                (_, false) => CrossMatchResult.Inconclusive
            };

            var crossMatch = new CrossMatch
            {
                BloodRequestId = requestId,
                BloodProductId = product.ProductId,
                TechnicianId = technicianId,
                TestTime = DateTime.UtcNow,
                MajorSideResult = majorSideCompatible ? CrossMatchResult.Compatible : CrossMatchResult.Incompatible,
                MinorSideResult = minorSideCompatible ? CrossMatchResult.Compatible : CrossMatchResult.Incompatible,
                OverallResult = overallResult,
                TestMethod = "Saline + AHG",
                IsReserved = overallResult == CrossMatchResult.Compatible,
                ReservedUntil = overallResult == CrossMatchResult.Compatible ? DateTime.UtcNow.AddHours(24) : null,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.CrossMatches.AddAsync(crossMatch, cancellationToken);

            if (overallResult == CrossMatchResult.Compatible)
            {
                bloodProduct.Status = InventoryStatus.Reserved;
                bloodProduct.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.BloodProducts.Update(bloodProduct);
            }

            results.Add(_mapper.Map<CrossMatchResultDto>(crossMatch));
        }

        if (results.Any(r => r.OverallResult == CrossMatchResult.Compatible))
        {
            request.Status = "Matched";
            request.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodRequests.Update(request);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return results;
    }

    public async Task<CrossMatchResultDto> RecordCrossMatchResultAsync(RecordCrossMatchDto matchDto, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.GetByIdAsync(matchDto.BloodRequestId, cancellationToken)
            ?? throw new NotFoundException("BloodRequest", matchDto.BloodRequestId);

        var product = await _unitOfWork.BloodProducts.GetByIdAsync(matchDto.BloodProductId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", matchDto.BloodProductId);

        if (product.Status != InventoryStatus.InStock && product.Status != InventoryStatus.Reserved)
        {
            throw new ProductReservedException(product.Id);
        }

        if (product.ExpiryDate <= DateTime.UtcNow)
        {
            throw new ProductExpiredException(product.Id, product.ExpiryDate);
        }

        var overallResult = (matchDto.MajorSideResult, matchDto.MinorSideResult) switch
        {
            (CrossMatchResult.Compatible, CrossMatchResult.Compatible) => CrossMatchResult.Compatible,
            (CrossMatchResult.Incompatible, _) => CrossMatchResult.Incompatible,
            (_, CrossMatchResult.Incompatible) => CrossMatchResult.Inconclusive,
            _ => CrossMatchResult.Inconclusive
        };

        var crossMatch = new CrossMatch
        {
            BloodRequestId = matchDto.BloodRequestId,
            BloodProductId = matchDto.BloodProductId,
            TechnicianId = matchDto.TechnicianId,
            TestTime = matchDto.TestTime,
            MajorSideResult = matchDto.MajorSideResult,
            MinorSideResult = matchDto.MinorSideResult,
            OverallResult = overallResult,
            TestMethod = matchDto.TestMethod,
            ReagentUsed = matchDto.ReagentUsed,
            Notes = matchDto.Notes,
            IsReserved = overallResult == CrossMatchResult.Compatible,
            ReservedUntil = overallResult == CrossMatchResult.Compatible ? DateTime.UtcNow.AddHours(24) : null,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.CrossMatches.AddAsync(crossMatch, cancellationToken);

        if (overallResult == CrossMatchResult.Compatible)
        {
            product.Status = InventoryStatus.Reserved;
            product.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodProducts.Update(product);
        }

        return _mapper.Map<CrossMatchResultDto>(crossMatch);
    }

    public async Task<IssueResultDto> IssueProductsAsync(Guid requestId, Guid operatorId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Issuing products for request {RequestId}", requestId);

        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.Id == requestId && !r.IsDeleted)
            .Include(r => r.CrossMatches)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodRequest", requestId);

        var compatibleMatches = request.CrossMatches
            .Where(cm => !cm.IsDeleted && cm.OverallResult == CrossMatchResult.Compatible)
            .OrderBy(cm => cm.TestTime)
            .ToList();

        var needed = request.QuantityRequested - request.QuantityIssued;
        var matchesToIssue = compatibleMatches.Take(needed).ToList();

        if (!matchesToIssue.Any())
        {
            throw new CrossMatchIncompatibleException(requestId, Guid.Empty);
        }

        var operatorUser = await _unitOfWork.Users.GetByIdAsync(operatorId, cancellationToken)
            ?? throw new NotFoundException("User", operatorId);

        var issuedProducts = new List<IssuedProductDto>();
        var issueTime = DateTime.UtcNow;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var match in matchesToIssue)
            {
                var product = await _unitOfWork.BloodProducts.GetByIdAsync(match.BloodProductId, cancellationToken);
                if (product == null || product.ExpiryDate <= DateTime.UtcNow) continue;

                product.Status = InventoryStatus.Issued;
                product.UpdatedAt = issueTime;
                _unitOfWork.BloodProducts.Update(product);

                issuedProducts.Add(new IssuedProductDto(
                    product.Id,
                    product.ProductCode,
                    product.BloodGroup.ToString(),
                    product.ProductType,
                    product.Volume,
                    product.ExpiryDate
                ));
            }

            request.QuantityIssued += issuedProducts.Count;
            request.Status = request.QuantityIssued >= request.QuantityRequested ? "Fulfilled" : "PartiallyFulfilled";
            request.FulfilledAt = issueTime;
            request.UpdatedAt = issueTime;
            _unitOfWork.BloodRequests.Update(request);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation("Issued {Count} products for request {RequestId}", issuedProducts.Count, requestId);

        return new IssueResultDto(
            requestId,
            request.RequestNumber,
            issuedProducts.Count,
            issuedProducts,
            issueTime,
            operatorUser.FullName
        );
    }

    public async Task<BloodRequestDto> UpdateRequestStatusAsync(Guid requestId, string status, string? notes, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.GetByIdAsync(requestId, cancellationToken)
            ?? throw new NotFoundException("BloodRequest", requestId);

        request.Status = status;
        if (!string.IsNullOrEmpty(notes))
        {
            request.Notes = string.IsNullOrEmpty(request.Notes) ? notes : $"{request.Notes}; {notes}";
        }
        request.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.BloodRequests.Update(request);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BloodRequestDto>(request);
    }

    public async Task<IEnumerable<CompatibleProductDto>> FindCompatibleProductsAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.Id == requestId && !r.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodRequest", requestId);

        var patientBloodGroup = new BloodGroup
        {
            ABO = request.PatientBloodGroup.ABO,
            Rh = request.PatientBloodGroup.Rh
        };

        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && bp.Status == InventoryStatus.InStock
                && bp.ProductType == request.ProductType
                && bp.ExpiryDate > DateTime.UtcNow)
            .ToListAsync(cancellationToken);

        var compatible = products
            .Where(bp => bp.BloodGroup.IsCompatibleWith(patientBloodGroup))
            .Select(bp => new CompatibleProductDto(
                bp.Id,
                bp.ProductCode,
                bp.BloodGroup.ToString(),
                bp.ProductType,
                bp.Volume,
                bp.ExpiryDate,
                (int)(bp.ExpiryDate - DateTime.UtcNow).TotalDays,
                bp.StorageLocation,
                request.Urgency == UrgencyLevel.Emergency
            ))
            .OrderBy(p => request.Urgency == UrgencyLevel.Emergency ? p.DaysUntilExpiry : 0)
            .ThenBy(p => p.ExpiryDate)
            .ToList();

        return compatible;
    }

    public async Task<RequestStatsDto> GetRequestStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var requests = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.CreatedAt >= startDate && r.CreatedAt <= endDate && !r.IsDeleted)
            .ToListAsync(cancellationToken);

        var fulfilledRequests = requests.Where(r => r.Status == "Fulfilled").ToList();
        var responseTimes = fulfilledRequests
            .Where(r => r.FulfilledAt.HasValue)
            .Select(r => r.FulfilledAt!.Value - r.CreatedAt)
            .ToList();

        return new RequestStatsDto(
            TotalRequests: requests.Count,
            FulfilledRequests: fulfilledRequests.Count,
            PendingRequests: requests.Count(r => r.Status == "Pending"),
            CancelledRequests: requests.Count(r => r.Status == "Cancelled"),
            TotalUnitsRequested: requests.Sum(r => r.QuantityRequested),
            TotalUnitsIssued: requests.Sum(r => r.QuantityIssued),
            FulfillmentRate: requests.Any() ? Math.Round((decimal)fulfilledRequests.Count / requests.Count * 100, 2) : 0,
            AverageResponseTime: responseTimes.Any() ? TimeSpan.FromTicks((long)responseTimes.Average(t => t.Ticks)) : TimeSpan.Zero,
            ByUrgency: requests.GroupBy(r => r.Urgency).ToDictionary(g => g.Key, g => g.Count()),
            ByProductType: requests.GroupBy(r => r.ProductType).ToDictionary(g => g.Key, g => g.Count())
        );
    }

    public async Task CancelRequestAsync(Guid requestId, string reason, CancellationToken cancellationToken = default)
    {
        var request = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.Id == requestId && !r.IsDeleted)
            .Include(r => r.CrossMatches)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodRequest", requestId);

        request.Status = "Cancelled";
        request.Notes = string.IsNullOrEmpty(request.Notes) ? $"Cancelled: {reason}" : $"{request.Notes}; Cancelled: {reason}";
        request.UpdatedAt = DateTime.UtcNow;

        foreach (var match in request.CrossMatches.Where(cm => !cm.IsDeleted && cm.IsReserved))
        {
            var product = await _unitOfWork.BloodProducts.GetByIdAsync(match.BloodProductId, cancellationToken);
            if (product != null && product.Status == InventoryStatus.Reserved)
            {
                product.Status = InventoryStatus.InStock;
                product.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.BloodProducts.Update(product);
            }
            match.IsReserved = false;
            match.ReservedUntil = null;
            _unitOfWork.CrossMatches.Update(match);
        }

        _unitOfWork.BloodRequests.Update(request);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateRequestNumber(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year.ToString("D4");
        var month = DateTime.UtcNow.Month.ToString("D2");
        var day = DateTime.UtcNow.Day.ToString("D2");
        var count = await _unitOfWork.BloodRequests.CountAsync(
            r => r.CreatedAt.Year == DateTime.UtcNow.Year &&
                 r.CreatedAt.Month == DateTime.UtcNow.Month &&
                 !r.IsDeleted,
            cancellationToken);
        return $"BR{year}{month}{day}{(count + 1).ToString("D4")}";
    }
}
