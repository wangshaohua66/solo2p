using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Data.Repositories;
using BloodCenter.Infrastructure.Entities;
using BloodCenter.Infrastructure.Entities.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class ScrapTraceService : IScrapTraceService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<ScrapTraceService> _logger;

    public ScrapTraceService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<ScrapTraceService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ScrapRecordDto> CreateScrapRecordAsync(CreateScrapRecordDto scrapDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Creating scrap record for product {ProductId}", scrapDto.BloodProductId);

        var product = await _unitOfWork.BloodProducts.GetByIdAsync(scrapDto.BloodProductId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", scrapDto.BloodProductId);

        var @operator = await _unitOfWork.Users.GetByIdAsync(scrapDto.OperatorId, cancellationToken)
            ?? throw new NotFoundException("User", scrapDto.OperatorId);

        if (product.Status == InventoryStatus.Scrapped)
        {
            throw new AlreadyExistsException("ScrapRecord", "BloodProductId", scrapDto.BloodProductId);
        }

        var scrapRecord = new ScrapRecord
        {
            BloodProductId = scrapDto.BloodProductId,
            Reason = scrapDto.Reason,
            DetailedReason = scrapDto.DetailedReason,
            ScrapDate = scrapDto.ScrapDate,
            OperatorId = scrapDto.OperatorId,
            DisposalMethod = scrapDto.DisposalMethod,
            Notes = scrapDto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _unitOfWork.ScrapRecords.AddAsync(scrapRecord, cancellationToken);

            product.Status = InventoryStatus.Scrapped;
            product.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodProducts.Update(product);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogWarning("Product {ProductId} scrapped. Reason: {Reason}", scrapDto.BloodProductId, scrapDto.Reason);
        return _mapper.Map<ScrapRecordDto>(scrapRecord);
    }

    public async Task<ScrapRecordDto> ApproveScrapRecordAsync(Guid scrapId, Guid approvedById, string? approvalNotes, CancellationToken cancellationToken = default)
    {
        var scrap = await _unitOfWork.ScrapRecords.GetByIdAsync(scrapId, cancellationToken)
            ?? throw new NotFoundException("ScrapRecord", scrapId);

        var approver = await _unitOfWork.Users.GetByIdAsync(approvedById, cancellationToken)
            ?? throw new NotFoundException("User", approvedById);

        if (approver.Role != UserRole.Administrator)
        {
            throw new ForbiddenException("Only administrators can approve scrap records");
        }

        if (scrap.OperatorId == approvedById)
        {
            throw new ForbiddenException("Cannot approve own scrap record");
        }

        scrap.ApprovedById = approvedById;
        scrap.ApprovedAt = DateTime.UtcNow;
        scrap.Notes = string.IsNullOrEmpty(scrap.Notes) ? approvalNotes : $"{scrap.Notes}; Approval: {approvalNotes}";
        scrap.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.ScrapRecords.Update(scrap);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<ScrapRecordDto>(scrap);
    }

    public async Task<ScrapRecordDto?> GetScrapRecordByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var scrap = await _unitOfWork.ScrapRecords.Query()
            .Where(s => s.Id == id && !s.IsDeleted)
            .Include(s => s.BloodProduct)
            .Include(s => s.Operator)
            .Include(s => s.ApprovedBy)
            .FirstOrDefaultAsync(cancellationToken);

        return scrap == null ? null : _mapper.Map<ScrapRecordDto>(scrap);
    }

    public async Task<PagedResult<ScrapRecordDto>> GetScrapRecordsAsync(SearchScrapQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.ScrapRecords.Query().Where(s => !s.IsDeleted);

        if (query.ProductId.HasValue)
        {
            queryable = queryable.Where(s => s.BloodProductId == query.ProductId.Value);
        }

        if (query.Reason.HasValue)
        {
            queryable = queryable.Where(s => s.Reason == query.Reason.Value);
        }

        if (query.OperatorId.HasValue)
        {
            queryable = queryable.Where(s => s.OperatorId == query.OperatorId.Value);
        }

        if (query.StartDate.HasValue)
        {
            queryable = queryable.Where(s => s.ScrapDate >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            queryable = queryable.Where(s => s.ScrapDate <= query.EndDate.Value);
        }

        if (query.ApprovedOnly == true)
        {
            queryable = queryable.Where(s => s.ApprovedById != null);
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .Include(s => s.BloodProduct)
            .Include(s => s.Operator)
            .Include(s => s.ApprovedBy)
            .OrderByDescending(s => s.ScrapDate)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ScrapRecordDto>(
            _mapper.Map<IEnumerable<ScrapRecordDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IEnumerable<ScrapRecordDto>> GetScrapsByProductAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var scraps = await _unitOfWork.ScrapRecords.Query()
            .Where(s => s.BloodProductId == productId && !s.IsDeleted)
            .Include(s => s.Operator)
            .Include(s => s.ApprovedBy)
            .OrderByDescending(s => s.ScrapDate)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<ScrapRecordDto>>(scraps);
    }

    public async Task ProcessAutoScrapForExpiredProductsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var expiredProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && (bp.Status == InventoryStatus.InStock || bp.Status == InventoryStatus.Reserved || bp.Status == InventoryStatus.ScrapPending)
                && bp.ExpiryDate <= now)
            .ToListAsync(cancellationToken);

        var systemUserId = await _unitOfWork.Users.Query()
            .Where(u => u.UserName == "system" && !u.IsDeleted)
            .Select(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (systemUserId == Guid.Empty)
        {
            var firstAdmin = await _unitOfWork.Users.Query()
                .Where(u => u.Role == UserRole.Administrator && !u.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            systemUserId = firstAdmin?.Id ?? Guid.Empty;
        }

        foreach (var product in expiredProducts)
        {
            var scrapRecord = new ScrapRecord
            {
                BloodProductId = product.Id,
                Reason = ScrapReason.Expired,
                DetailedReason = $"Auto-scrap: product expired on {product.ExpiryDate:yyyy-MM-dd HH:mm}",
                ScrapDate = now,
                OperatorId = systemUserId,
                DisposalMethod = "Medical waste disposal",
                Notes = "Automated expired product scrap",
                CreatedAt = now
            };

            await _unitOfWork.ScrapRecords.AddAsync(scrapRecord, cancellationToken);

            product.Status = InventoryStatus.Scrapped;
            product.UpdatedAt = now;
            _unitOfWork.BloodProducts.Update(product);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Auto-scrap processed {Count} expired products", expiredProducts.Count);
    }

    public async Task<TraceResultDto> TraceProductForwardAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.Id == productId && !bp.IsDeleted)
            .Include(bp => bp.Donation)
                .ThenInclude(d => d!.Donor)
            .Include(bp => bp.CrossMatches)
                .ThenInclude(cm => cm.BloodRequest)
                    .ThenInclude(br => br!.Hospital)
            .Include(bp => bp.ScrapRecords)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        var nodes = new List<TraceNodeDto>();

        nodes.Add(new TraceNodeDto(
            "Donor",
            product.Donation?.DonorId.ToString() ?? "Unknown",
            $"Donor: {product.Donation?.Donor?.FirstName} {product.Donation?.Donor?.LastName}",
            product.Donation?.DonationDate ?? DateTime.MinValue,
            product.Donation?.Nurse?.FullName,
            "Donation Recorded",
            new[]
            {
                new TraceLinkDto("produced", product.DonationId.ToString(), "Donation")
            }
        ));

        nodes.Add(new TraceNodeDto(
            "Donation",
            product.DonationId.ToString(),
            $"Donation: {product.Donation?.DonationNumber}",
            product.ProductionDate,
            product.PreparedBy?.FullName,
            "Blood Collected",
            new[]
            {
                new TraceLinkDto("processed_into", productId.ToString(), "BloodProduct")
            }
        ));

        nodes.Add(new TraceNodeDto(
            "BloodProduct",
            productId.ToString(),
            $"Product: {product.ProductCode} ({product.ProductType})",
            product.ProductionDate,
            product.PreparedBy?.FullName,
            product.Status.ToString(),
            Array.Empty<TraceLinkDto>()
        ));

        foreach (var crossMatch in product.CrossMatches.Where(cm => !cm.IsDeleted))
        {
            nodes.Add(new TraceNodeDto(
                "CrossMatch",
                crossMatch.Id.ToString(),
                $"Cross Match with {crossMatch.BloodRequest?.PatientName}",
                crossMatch.TestTime,
                crossMatch.Technician?.FullName,
                crossMatch.OverallResult.ToString(),
                new[]
                {
                    new TraceLinkDto("matched_for", crossMatch.BloodRequestId.ToString(), "BloodRequest")
                }
            ));

            nodes.Add(new TraceNodeDto(
                "BloodRequest",
                crossMatch.BloodRequestId.ToString(),
                $"Request: {crossMatch.BloodRequest?.RequestNumber} - Patient: {crossMatch.BloodRequest?.PatientName}",
                crossMatch.BloodRequest?.CreatedAt ?? DateTime.MinValue,
                crossMatch.BloodRequest?.RequestedBy,
                crossMatch.BloodRequest?.Status ?? "Unknown",
                new[]
                {
                    new TraceLinkDto("sent_to", crossMatch.BloodRequest?.HospitalId.ToString() ?? "", "Hospital")
                }
            ));

            nodes.Add(new TraceNodeDto(
                "Hospital",
                crossMatch.BloodRequest?.HospitalId.ToString() ?? "Unknown",
                $"Hospital: {crossMatch.BloodRequest?.Hospital?.Name}",
                crossMatch.BloodRequest?.FulfilledAt ?? DateTime.MinValue,
                crossMatch.BloodRequest?.Hospital?.ContactPerson,
                "Recipient",
                Array.Empty<TraceLinkDto>()
            ));
        }

        foreach (var scrap in product.ScrapRecords.Where(s => !s.IsDeleted))
        {
            nodes.Add(new TraceNodeDto(
                "Scrap",
                scrap.Id.ToString(),
                $"Scrap: {scrap.Reason}",
                scrap.ScrapDate,
                scrap.Operator?.FullName,
                "Scrapped",
                Array.Empty<TraceLinkDto>()
            ));
        }

        return new TraceResultDto(
            productId,
            "Forward",
            nodes,
            DateTime.UtcNow
        );
    }

    public async Task<TraceResultDto> TraceProductBackwardAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var forwardTrace = await TraceProductForwardAsync(productId, cancellationToken);
        var reversedNodes = forwardTrace.TraceChain.Reverse().ToList();

        return new TraceResultDto(
            productId,
            "Backward",
            reversedNodes,
            DateTime.UtcNow
        );
    }

    public async Task<TraceResultDto> TraceByDonorAsync(Guid donorId, CancellationToken cancellationToken = default)
    {
        var donations = await _unitOfWork.Donations.Query()
            .Where(d => d.DonorId == donorId && !d.IsDeleted)
            .Include(d => d.BloodProducts)
            .ToListAsync(cancellationToken);

        var nodes = new List<TraceNodeDto>();

        var donor = await _unitOfWork.Donors.GetByIdAsync(donorId, cancellationToken);
        nodes.Add(new TraceNodeDto(
            "Donor",
            donorId.ToString(),
            $"Donor: {donor?.FirstName} {donor?.LastName} ({donor?.DonorNumber})",
            donor?.CreatedAt ?? DateTime.MinValue,
            null,
            donor?.Status.ToString() ?? "Unknown",
            donations.Select(d => new TraceLinkDto("donated", d.Id.ToString(), "Donation"))
        ));

        foreach (var donation in donations)
        {
            nodes.Add(new TraceNodeDto(
                "Donation",
                donation.Id.ToString(),
                $"Donation: {donation.DonationNumber}",
                donation.DonationDate,
                null,
                donation.Status.ToString(),
                donation.BloodProducts.Where(bp => !bp.IsDeleted)
                    .Select(bp => new TraceLinkDto("produced", bp.Id.ToString(), "BloodProduct"))
            ));

            foreach (var product in donation.BloodProducts.Where(bp => !bp.IsDeleted))
            {
                nodes.Add(new TraceNodeDto(
                    "BloodProduct",
                    product.Id.ToString(),
                    $"Product: {product.ProductCode} ({product.ProductType}) - {product.Status}",
                    product.ProductionDate,
                    null,
                    product.Status.ToString(),
                    Array.Empty<TraceLinkDto>()
                ));
            }
        }

        return new TraceResultDto(
            donorId,
            "DonorTrace",
            nodes,
            DateTime.UtcNow
        );
    }

    public async Task<TraceResultDto> TraceByPatientAsync(string patientId, CancellationToken cancellationToken = default)
    {
        var requests = await _unitOfWork.BloodRequests.Query()
            .Where(r => r.PatientId == patientId && !r.IsDeleted)
            .Include(r => r.CrossMatches)
                .ThenInclude(cm => cm.BloodProduct)
                    .ThenInclude(bp => bp!.Donation)
                        .ThenInclude(d => d!.Donor)
            .Include(r => r.Hospital)
            .ToListAsync(cancellationToken);

        var nodes = new List<TraceNodeDto>();

        nodes.Add(new TraceNodeDto(
            "Patient",
            patientId,
            $"Patient ID: {patientId}",
            requests.FirstOrDefault()?.CreatedAt ?? DateTime.MinValue,
            null,
            "Patient",
            requests.Select(r => new TraceLinkDto("requested", r.Id.ToString(), "BloodRequest"))
        ));

        foreach (var request in requests)
        {
            nodes.Add(new TraceNodeDto(
                "BloodRequest",
                request.Id.ToString(),
                $"Request: {request.RequestNumber}",
                request.CreatedAt,
                request.RequestedBy,
                request.Status,
                request.CrossMatches.Where(cm => !cm.IsDeleted)
                    .Select(cm => new TraceLinkDto("matched_with", cm.BloodProductId.ToString(), "BloodProduct"))
            ));

            foreach (var match in request.CrossMatches.Where(cm => !cm.IsDeleted && cm.OverallResult == CrossMatchResult.Compatible))
            {
                var product = match.BloodProduct;
                if (product?.Donation?.Donor != null)
                {
                    nodes.Add(new TraceNodeDto(
                        "Donor",
                        product.Donation.DonorId.ToString(),
                        $"Donor: {product.Donation.Donor.FirstName} {product.Donation.Donor.LastName}",
                        product.Donation.DonationDate,
                        null,
                        "Source",
                        Array.Empty<TraceLinkDto>()
                    ));
                }
            }
        }

        return new TraceResultDto(
            Guid.TryParse(patientId, out var pid) ? pid : Guid.Empty,
            "PatientTrace",
            nodes,
            DateTime.UtcNow
        );
    }

    public async Task<ScrapStatsDto> GetScrapStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var scraps = await _unitOfWork.ScrapRecords.Query()
            .Where(s => s.ScrapDate >= startDate && s.ScrapDate <= endDate && !s.IsDeleted)
            .Include(s => s.BloodProduct)
            .ToListAsync(cancellationToken);

        var totalProducts = await _unitOfWork.BloodProducts.CountAsync(
            bp => bp.ProductionDate >= startDate && bp.ProductionDate <= endDate && !bp.IsDeleted,
            cancellationToken);

        return new ScrapStatsDto(
            TotalScrappedUnits: scraps.Count,
            ExpiredUnits: scraps.Count(s => s.Reason == ScrapReason.Expired),
            TestPositiveUnits: scraps.Count(s => s.Reason == ScrapReason.TestPositive),
            QualityUnits: scraps.Count(s => s.Reason == ScrapReason.Hemolysis || s.Reason == ScrapReason.BacterialContamination),
            ScrapRate: totalProducts > 0 ? Math.Round((decimal)scraps.Count / totalProducts * 100, 2) : 0,
            ByReason: scraps.GroupBy(s => s.Reason).ToDictionary(g => g.Key, g => g.Count()),
            ByProductType: scraps.GroupBy(s => s.BloodProduct.ProductType).ToDictionary(g => g.Key, g => g.Count()),
            ByBloodType: scraps.GroupBy(s => s.BloodProduct.BloodGroup.ABO).ToDictionary(g => g.Key, g => g.Count()),
            FinancialImpact: scraps.Count * 200
        );
    }

    public async Task<IEnumerable<ProductTraceDto>> GetFullTraceChainAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.Id == productId && !bp.IsDeleted)
            .Include(bp => bp.Donation).ThenInclude(d => d!.Donor)
            .Include(bp => bp.CrossMatches).ThenInclude(cm => cm.BloodRequest).ThenInclude(br => br!.Hospital)
            .Include(bp => bp.ScrapRecords)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        var events = new List<TraceEventDto>();

        events.Add(new TraceEventDto(
            product.Donation?.DonationDate ?? DateTime.MinValue,
            "Donation",
            $"Blood donated by {product.Donation?.Donor?.FirstName} {product.Donation?.Donor?.LastName}",
            product.Donation?.Nurse?.FullName,
            "Collection Site"
        ));

        events.Add(new TraceEventDto(
            product.ProductionDate,
            "Production",
            $"Product {product.ProductCode} created ({product.ProductType})",
            product.PreparedBy?.FullName,
            product.StorageLocation ?? "Preparation Lab"
        ));

        foreach (var match in product.CrossMatches.Where(cm => !cm.IsDeleted))
        {
            events.Add(new TraceEventDto(
                match.TestTime,
                "CrossMatch",
                $"Cross match performed - Result: {match.OverallResult}",
                match.Technician?.FullName,
                "Laboratory"
            ));

            if (match.OverallResult == CrossMatchResult.Compatible && match.BloodRequest != null)
            {
                events.Add(new TraceEventDto(
                    match.BloodRequest.FulfilledAt ?? match.TestTime,
                    "Issue",
                    $"Issued to {match.BloodRequest.Hospital?.Name} for patient {match.BloodRequest.PatientName}",
                    match.BloodRequest.RequestedBy,
                    match.BloodRequest.Hospital?.Name ?? "Hospital"
                ));
            }
        }

        foreach (var scrap in product.ScrapRecords.Where(s => !s.IsDeleted))
        {
            events.Add(new TraceEventDto(
                scrap.ScrapDate,
                "Scrap",
                $"Scrapped - Reason: {scrap.Reason}. {scrap.DetailedReason}",
                scrap.Operator?.FullName,
                "Disposal"
            ));
        }

        var trace = new ProductTraceDto(
            product.Id,
            product.ProductCode,
            product.ProductType,
            product.BloodGroup.ToString(),
            product.ProductionDate,
            product.CrossMatches.FirstOrDefault(cm => !cm.IsDeleted && cm.OverallResult == CrossMatchResult.Compatible)?.BloodRequest?.FulfilledAt,
            product.CrossMatches.FirstOrDefault(cm => !cm.IsDeleted && cm.OverallResult == CrossMatchResult.Compatible)?.BloodRequest?.PatientName,
            events.OrderBy(e => e.EventTime)
        );

        return new[] { trace };
    }

    public async Task DeleteScrapRecordAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var scrap = await _unitOfWork.ScrapRecords.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("ScrapRecord", id);

        _unitOfWork.ScrapRecords.Delete(scrap);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
