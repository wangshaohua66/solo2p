using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Interfaces;

public interface IInventoryService
{
    Task<PagedResult<InventoryItemDto>> GetInventorySummaryAsync(int pageNumber, int pageSize, CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryAlertDto>> GetInventoryAlertsAsync(CancellationToken cancellationToken = default);
    Task<BloodTypeBalanceDto> GetBloodTypeBalanceAnalysisAsync(CancellationToken cancellationToken = default);
    Task<BloodCollectionPlanDto> GenerateCollectionPlanAsync(CancellationToken cancellationToken = default);
    Task<PagedResult<InventoryItemDto>> GetInventoryItemsAsync(SearchInventoryQuery query, CancellationToken cancellationToken = default);
    Task<InventoryItemDto?> GetInventoryItemByProductIdAsync(Guid productId, CancellationToken cancellationToken = default);
    Task MarkAsInStockAsync(Guid productId, string storageLocation, CancellationToken cancellationToken = default);
    Task ReserveProductAsync(Guid productId, DateTime reservedUntil, CancellationToken cancellationToken = default);
    Task ReleaseReservationAsync(Guid productId, CancellationToken cancellationToken = default);
    Task ProcessExpiredProductsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryHistoryDto>> GetInventoryHistoryAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<InventoryTrendDto> GetInventoryTrendAsync(int days, CancellationToken cancellationToken = default);
    Task SetSafetyStockLevelAsync(BloodProductType productType, BloodType bloodType, RhFactor rhFactor, int minimumLevel, CancellationToken cancellationToken = default);
    Task<InventorySettingsDto> GetInventorySettingsAsync(CancellationToken cancellationToken = default);
    Task CheckAndSendAlertsAsync(CancellationToken cancellationToken = default);
}

public record SearchInventoryQuery(
    BloodProductType? ProductType,
    BloodType? BloodType,
    RhFactor? RhFactor,
    InventoryStatus? Status,
    string? StorageLocation,
    bool? ExpiringSoon,
    int PageNumber = 1,
    int PageSize = 20
);

public record InventoryItemDto(
    Guid ProductId,
    string ProductCode,
    BloodProductType ProductType,
    string BloodGroupDisplay,
    BloodType BloodType,
    RhFactor RhFactor,
    int Volume,
    DateTime ProductionDate,
    DateTime ExpiryDate,
    int DaysUntilExpiry,
    InventoryStatus Status,
    string? StorageLocation,
    bool IsExpiringSoon,
    bool IsExpired
);

public record InventoryAlertDto(
    Guid Id,
    string AlertType,
    string Message,
    BloodProductType? ProductType,
    BloodType? BloodType,
    RhFactor? RhFactor,
    int CurrentStock,
    int Threshold,
    DateTime AlertTime,
    string Severity
);

public record BloodTypeBalanceDto(
    IEnumerable<BloodTypeInventoryItem> InventoryByType,
    string RecommendedPriorityBloodType,
    decimal OverallBalanceScore,
    Dictionary<string, decimal> SupplyDemandRatio
);

public record BloodTypeInventoryItem(
    BloodType BloodType,
    RhFactor RhFactor,
    int CurrentStock,
    int AverageWeeklyUsage,
    int DaysOfSupply,
    int SafetyStock,
    string Status
);

public record BloodCollectionPlanDto(
    DateTime PlanDate,
    IEnumerable<CollectionTarget> CollectionTargets,
    string PriorityBloodTypes,
    int TotalTargetUnits,
    string Justification
);

public record CollectionTarget(
    BloodType BloodType,
    RhFactor RhFactor,
    int TargetUnits,
    string Priority
);

public record InventoryHistoryDto(
    DateTime Date,
    BloodProductType ProductType,
    BloodType BloodType,
    RhFactor RhFactor,
    int BeginningStock,
    int Received,
    int Issued,
    int Scrapped,
    int EndingStock
);

public record InventoryTrendDto(
    IEnumerable<DailyInventoryPoint> DailyPoints,
    decimal AverageStockLevel,
    decimal StockTurnoverRate,
    string TrendDirection
);

public record DailyInventoryPoint(
    DateTime Date,
    int TotalUnits,
    int ExpiringUnits
);

public record InventorySettingsDto(
    IEnumerable<SafetyStockLevel> SafetyStockLevels,
    int ExpirationWarningHours,
    int EmergencyReservePercent
);

public record SafetyStockLevel(
    BloodProductType ProductType,
    BloodType BloodType,
    RhFactor RhFactor,
    int MinimumLevel
);
