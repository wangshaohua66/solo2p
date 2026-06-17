using AutoMapper;
using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class ComponentPreparationService : IComponentPreparationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<ComponentPreparationService> _logger;

    public ComponentPreparationService(IUnitOfWork unitOfWork, IMapper mapper, ILogger<ComponentPreparationService> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<IEnumerable<BloodProductDto>> ProcessWholeBloodAsync(Guid donationId, Guid preparedById, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing whole blood for donation {DonationId}", donationId);

        var donation = await _unitOfWork.Donations.Query()
            .Where(d => d.Id == donationId && !d.IsDeleted)
            .Include(d => d.Donor)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Donation", donationId);

        if (donation.Status != DonationStatus.Released && donation.Status != DonationStatus.Completed)
        {
            throw new InvalidOperationException($"Cannot process donation in {donation.Status} status");
        }

        if (donation.IsQuarantined)
        {
            throw new InvalidOperationException("Cannot process quarantined donation");
        }

        var preparer = await _unitOfWork.Users.GetByIdAsync(preparedById, cancellationToken)
            ?? throw new NotFoundException("Preparer", preparedById);

        var existingProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.DonationId == donationId && !bp.IsDeleted)
            .ToListAsync(cancellationToken);

        if (existingProducts.Any())
        {
            throw new AlreadyExistsException("BloodProducts", "DonationId", donationId);
        }

        var batchNumber = $"BATCH{DateTime.UtcNow:yyyyMMddHHmmss}";
        var productionDate = DateTime.UtcNow;
        var bloodGroup = new BloodGroup
        {
            ABO = donation.BloodGroup.ABO,
            Rh = donation.BloodGroup.Rh
        };

        var products = new List<BloodProduct>
        {
            new()
            {
                ProductCode = await GenerateProductCode(BloodProductType.RedBloodCells, cancellationToken),
                DonationId = donationId,
                ProductType = BloodProductType.RedBloodCells,
                BloodGroup = bloodGroup,
                Volume = 200,
                Unit = "ml",
                ProductionDate = productionDate,
                ExpiryDate = productionDate.AddDays(35),
                StorageLocation = $"RBC-{bloodGroup}",
                StorageTemperature = "2-6°C",
                Status = InventoryStatus.InStock,
                IsSpecialProduct = false,
                PreparedById = preparedById,
                PreparedAt = productionDate,
                BatchNumber = batchNumber,
                CreatedAt = productionDate
            },
            new()
            {
                ProductCode = await GenerateProductCode(BloodProductType.Plasma, cancellationToken),
                DonationId = donationId,
                ProductType = BloodProductType.Plasma,
                BloodGroup = bloodGroup,
                Volume = 150,
                Unit = "ml",
                ProductionDate = productionDate,
                ExpiryDate = productionDate.AddDays(365),
                StorageLocation = $"PLASMA-{bloodGroup}",
                StorageTemperature = "-18°C",
                Status = InventoryStatus.InStock,
                IsSpecialProduct = false,
                PreparedById = preparedById,
                PreparedAt = productionDate,
                BatchNumber = batchNumber,
                CreatedAt = productionDate
            },
            new()
            {
                ProductCode = await GenerateProductCode(BloodProductType.Platelets, cancellationToken),
                DonationId = donationId,
                ProductType = BloodProductType.Platelets,
                BloodGroup = bloodGroup,
                Volume = 50,
                Unit = "ml",
                ProductionDate = productionDate,
                ExpiryDate = productionDate.AddDays(5),
                StorageLocation = $"PLT-{bloodGroup}",
                StorageTemperature = "20-24°C",
                Status = InventoryStatus.InStock,
                IsSpecialProduct = false,
                PreparedById = preparedById,
                PreparedAt = productionDate,
                BatchNumber = batchNumber,
                CreatedAt = productionDate
            }
        };

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _unitOfWork.BloodProducts.AddRangeAsync(products, cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        _logger.LogInformation("Created {Count} blood products for donation {DonationId}", products.Count, donationId);
        return _mapper.Map<IEnumerable<BloodProductDto>>(products);
    }

    public async Task<BloodProductDto> PrepareSpecialProductAsync(CreateSpecialProductDto productDto, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Preparing special product {ProductType} for donation {DonationId}", productDto.ProductType, productDto.DonationId);

        var donation = await _unitOfWork.Donations.GetByIdAsync(productDto.DonationId, cancellationToken)
            ?? throw new NotFoundException("Donation", productDto.DonationId);

        if (donation.IsQuarantined)
        {
            throw new InvalidOperationException("Cannot prepare products from quarantined donation");
        }

        var preparer = await _unitOfWork.Users.GetByIdAsync(productDto.PreparedById, cancellationToken)
            ?? throw new NotFoundException("Preparer", productDto.PreparedById);

        var productionDate = DateTime.UtcNow;
        var expiryDays = productDto.ProductType switch
        {
            BloodProductType.Cryoprecipitate => 365,
            BloodProductType.WashedRedCells => 24,
            _ => 35
        };

        var product = new BloodProduct
        {
            ProductCode = await GenerateProductCode(productDto.ProductType, cancellationToken),
            DonationId = productDto.DonationId,
            ProductType = productDto.ProductType,
            BloodGroup = new BloodGroup
            {
                ABO = donation.BloodGroup.ABO,
                Rh = donation.BloodGroup.Rh
            },
            Volume = productDto.Volume,
            Unit = "ml",
            ProductionDate = productionDate,
            ExpiryDate = productionDate.AddDays(expiryDays),
            StorageLocation = productDto.StorageLocation ?? $"{productDto.ProductType}-{donation.BloodGroup}",
            StorageTemperature = productDto.ProductType switch
            {
                BloodProductType.Cryoprecipitate => "-18°C",
                BloodProductType.WashedRedCells => "2-6°C",
                _ => "2-6°C"
            },
            Status = InventoryStatus.InStock,
            IsSpecialProduct = true,
            SpecialProductReason = productDto.SpecialProductReason,
            PreparationMethod = productDto.PreparationMethod,
            PreparedById = productDto.PreparedById,
            PreparedAt = productionDate,
            BatchNumber = $"BATCH{productionDate:yyyyMMddHHmmss}",
            CreatedAt = productionDate
        };

        await _unitOfWork.BloodProducts.AddAsync(product, cancellationToken);
        return _mapper.Map<BloodProductDto>(product);
    }

    public async Task<BloodProductDto?> GetProductByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.Id == id && !bp.IsDeleted)
            .Include(bp => bp.Donation)
            .Include(bp => bp.PreparedBy)
            .FirstOrDefaultAsync(cancellationToken);

        return product == null ? null : _mapper.Map<BloodProductDto>(product);
    }

    public async Task<BloodProductDto?> GetProductByCodeAsync(string productCode, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.ProductCode == productCode && !bp.IsDeleted)
            .Include(bp => bp.Donation)
            .Include(bp => bp.PreparedBy)
            .FirstOrDefaultAsync(cancellationToken);

        return product == null ? null : _mapper.Map<BloodProductDto>(product);
    }

    public async Task<PagedResult<BloodProductDto>> GetProductsAsync(SearchProductQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.BloodProducts.Query().Where(bp => !bp.IsDeleted);

        if (query.DonationId.HasValue)
        {
            queryable = queryable.Where(bp => bp.DonationId == query.DonationId.Value);
        }

        if (query.ProductType.HasValue)
        {
            queryable = queryable.Where(bp => bp.ProductType == query.ProductType.Value);
        }

        if (query.BloodType.HasValue)
        {
            queryable = queryable.Where(bp => bp.BloodGroup.ABO == query.BloodType.Value);
        }

        if (query.RhFactor.HasValue)
        {
            queryable = queryable.Where(bp => bp.BloodGroup.Rh == query.RhFactor.Value);
        }

        if (query.Status.HasValue)
        {
            queryable = queryable.Where(bp => bp.Status == query.Status.Value);
        }

        if (query.ExpiryBefore.HasValue)
        {
            queryable = queryable.Where(bp => bp.ExpiryDate <= query.ExpiryBefore.Value);
        }

        if (query.ExpiryAfter.HasValue)
        {
            queryable = queryable.Where(bp => bp.ExpiryDate >= query.ExpiryAfter.Value);
        }

        if (!string.IsNullOrEmpty(query.StorageLocation))
        {
            queryable = queryable.Where(bp => bp.StorageLocation!.Contains(query.StorageLocation));
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .Include(bp => bp.Donation)
            .Include(bp => bp.PreparedBy)
            .OrderBy(bp => bp.ExpiryDate)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<BloodProductDto>(
            _mapper.Map<IEnumerable<BloodProductDto>>(items),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IEnumerable<BloodProductDto>> GetProductsByDonationAsync(Guid donationId, CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.DonationId == donationId && !bp.IsDeleted)
            .Include(bp => bp.PreparedBy)
            .OrderBy(bp => bp.ProductType)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<BloodProductDto>>(products);
    }

    public async Task<BloodProductDto> UpdateProductStorageAsync(Guid productId, string storageLocation, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        product.StorageLocation = storageLocation;
        product.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.BloodProducts.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<BloodProductDto>(product);
    }

    public async Task<IEnumerable<BloodProductDto>> GetExpiringProductsAsync(int withinHours, CancellationToken cancellationToken = default)
    {
        var threshold = DateTime.UtcNow.AddHours(withinHours);
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && bp.Status == InventoryStatus.InStock
                && bp.ExpiryDate <= threshold
                && bp.ExpiryDate > DateTime.UtcNow)
            .Include(bp => bp.Donation)
            .OrderBy(bp => bp.ExpiryDate)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<BloodProductDto>>(products);
    }

    public async Task<IEnumerable<BloodProductDto>> GetProductsToQuarantineAsync(CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.Quarantined)
            .Include(bp => bp.Donation)
            .OrderBy(bp => bp.ExpiryDate)
            .ToListAsync(cancellationToken);

        return _mapper.Map<IEnumerable<BloodProductDto>>(products);
    }

    public async Task<PreparationStatsDto> GetPreparationStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.ProductionDate >= startDate && bp.ProductionDate <= endDate && !bp.IsDeleted)
            .Include(bp => bp.Donation)
            .ToListAsync(cancellationToken);

        return new PreparationStatsDto(
            TotalProducts: products.Count,
            StandardProducts: products.Count(p => !p.IsSpecialProduct),
            SpecialProducts: products.Count(p => p.IsSpecialProduct),
            ByProductType: products.GroupBy(p => p.ProductType).ToDictionary(g => g.Key, g => g.Count()),
            ByBloodType: products.GroupBy(p => p.BloodGroup.ABO).ToDictionary(g => g.Key, g => g.Count()),
            AverageProcessingTimeMinutes: 0
        );
    }

    public async Task DeleteProductAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", id);

        var hasCrossMatches = await _unitOfWork.CrossMatches.ExistsAsync(
            cm => cm.BloodProductId == id && !cm.IsDeleted, cancellationToken);

        if (hasCrossMatches)
        {
            throw new InvalidOperationException("Cannot delete product with existing cross match records");
        }

        _unitOfWork.BloodProducts.Delete(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateProductCode(BloodProductType productType, CancellationToken cancellationToken)
    {
        var prefix = productType switch
        {
            BloodProductType.WholeBlood => "WB",
            BloodProductType.RedBloodCells => "RBC",
            BloodProductType.Plasma => "PL",
            BloodProductType.Platelets => "PT",
            BloodProductType.Cryoprecipitate => "CR",
            BloodProductType.WashedRedCells => "WR",
            _ => "BP"
        };

        var year = DateTime.UtcNow.Year.ToString("D4");
        var count = await _unitOfWork.BloodProducts.CountAsync(
            bp => bp.CreatedAt.Year == DateTime.UtcNow.Year && !bp.IsDeleted,
            cancellationToken);
        return $"{prefix}{year}{(count + 1).ToString("D6")}";
    }
}
