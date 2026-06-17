using BloodCenter.Infrastructure.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IComponentPreparationService
{
    Task<IEnumerable<BloodProductDto>> ProcessWholeBloodAsync(Guid donationId, Guid preparedById, CancellationToken cancellationToken = default);
    Task<BloodProductDto> PrepareSpecialProductAsync(CreateSpecialProductDto productDto, CancellationToken cancellationToken = default);
    Task<BloodProductDto?> GetProductByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<BloodProductDto?> GetProductByCodeAsync(string productCode, CancellationToken cancellationToken = default);
    Task<PagedResult<BloodProductDto>> GetProductsAsync(SearchProductQuery query, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodProductDto>> GetProductsByDonationAsync(Guid donationId, CancellationToken cancellationToken = default);
    Task<BloodProductDto> UpdateProductStorageAsync(Guid productId, string storageLocation, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodProductDto>> GetExpiringProductsAsync(int withinHours, CancellationToken cancellationToken = default);
    Task<IEnumerable<BloodProductDto>> GetProductsToQuarantineAsync(CancellationToken cancellationToken = default);
    Task<PreparationStatsDto> GetPreparationStatsAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task DeleteProductAsync(Guid id, CancellationToken cancellationToken = default);
}

public record CreateSpecialProductDto(
    Guid DonationId,
    BloodProductType ProductType,
    int Volume,
    string PreparationMethod,
    string SpecialProductReason,
    Guid PreparedById,
    string? StorageLocation
);

public record SearchProductQuery(
    Guid? DonationId,
    BloodProductType? ProductType,
    BloodType? BloodType,
    RhFactor? RhFactor,
    InventoryStatus? Status,
    DateTime? ExpiryBefore,
    DateTime? ExpiryAfter,
    string? StorageLocation,
    int PageNumber = 1,
    int PageSize = 20
);

public record BloodProductDto(
    Guid Id,
    string ProductCode,
    Guid DonationId,
    string DonationNumber,
    BloodProductType ProductType,
    string BloodGroupDisplay,
    BloodType BloodType,
    RhFactor RhFactor,
    int Volume,
    string Unit,
    DateTime ProductionDate,
    DateTime ExpiryDate,
    string? StorageLocation,
    string? StorageTemperature,
    InventoryStatus Status,
    bool IsSpecialProduct,
    string? SpecialProductReason,
    string? PreparationMethod,
    Guid? PreparedById,
    string? PreparedByName,
    DateTime? PreparedAt,
    string? BatchNumber,
    int DaysUntilExpiry,
    bool IsExpiringSoon
);

public record PreparationStatsDto(
    int TotalProducts,
    int StandardProducts,
    int SpecialProducts,
    Dictionary<BloodProductType, int> ByProductType,
    Dictionary<BloodType, int> ByBloodType,
    int AverageProcessingTimeMinutes
);
