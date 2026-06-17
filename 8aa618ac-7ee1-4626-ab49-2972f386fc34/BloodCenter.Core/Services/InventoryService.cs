using BloodCenter.Core.Exceptions;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class InventoryService : IInventoryService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<InventoryService> _logger;
    private readonly INotificationService _notificationService;

    public InventoryService(IUnitOfWork unitOfWork, ILogger<InventoryService> logger, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<InventoryItemDto>> GetInventorySummaryAsync(CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.InStock)
            .OrderBy(bp => bp.ExpiryDate)
            .ToListAsync(cancellationToken);

        return products.Select(MapToInventoryItem);
    }

    public async Task<IEnumerable<InventoryAlertDto>> GetInventoryAlertsAsync(CancellationToken cancellationToken = default)
    {
        var alerts = new List<InventoryAlertDto>();
        var now = DateTime.UtcNow;

        var lowStockItems = await GetLowStockItemsAsync(cancellationToken);
        foreach (var item in lowStockItems)
        {
            alerts.Add(new InventoryAlertDto(
                Id: Guid.NewGuid(),
                AlertType: "LowStock",
                Message: $"Low stock for {item.ProductType} {item.BloodType}{(item.RhFactor == RhFactor.Positive ? "+" : "-")}",
                ProductType: item.ProductType,
                BloodType: item.BloodType,
                RhFactor: item.RhFactor,
                CurrentStock: item.CurrentStock,
                Threshold: item.SafetyStock,
                AlertTime: now,
                Severity: "High"
            ));
        }

        var expiringProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && bp.Status == InventoryStatus.InStock
                && bp.ExpiryDate <= now.AddHours(24)
                && bp.ExpiryDate > now)
            .ToListAsync(cancellationToken);

        foreach (var product in expiringProducts)
        {
            alerts.Add(new InventoryAlertDto(
                Id: Guid.NewGuid(),
                AlertType: "ExpiringSoon",
                Message: $"Product {product.ProductCode} expires in {(product.ExpiryDate - now).TotalHours:F1} hours",
                ProductType: product.ProductType,
                BloodType: product.BloodGroup.ABO,
                RhFactor: product.BloodGroup.Rh,
                CurrentStock: 1,
                Threshold: 0,
                AlertTime: now,
                Severity: "Critical"
            ));
        }

        var expiredProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && (bp.Status == InventoryStatus.InStock || bp.Status == InventoryStatus.Reserved)
                && bp.ExpiryDate <= now)
            .ToListAsync(cancellationToken);

        foreach (var product in expiredProducts)
        {
            alerts.Add(new InventoryAlertDto(
                Id: Guid.NewGuid(),
                AlertType: "Expired",
                Message: $"Product {product.ProductCode} has expired",
                ProductType: product.ProductType,
                BloodType: product.BloodGroup.ABO,
                RhFactor: product.BloodGroup.Rh,
                CurrentStock: 1,
                Threshold: 0,
                AlertTime: now,
                Severity: "Critical"
            ));
        }

        return alerts.OrderByDescending(a => a.Severity).ThenBy(a => a.AlertType);
    }

    public async Task<BloodTypeBalanceDto> GetBloodTypeBalanceAnalysisAsync(CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.InStock)
            .ToListAsync(cancellationToken);

        var issuedProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.Issued)
            .ToListAsync(cancellationToken);

        var inventorySettings = await _unitOfWork.InventorySettings.Query()
            .Where(s => !s.IsDeleted)
            .ToDictionaryAsync(
                s => (s.ProductType, s.BloodType, s.RhFactor),
                s => s.MinimumLevel,
                cancellationToken);

        var inventoryByType = new List<BloodTypeInventoryItem>();
        var allBloodTypes = Enum.GetValues<BloodType>();
        var allRhFactors = Enum.GetValues<RhFactor>();

        foreach (var bloodType in allBloodTypes)
        {
            foreach (var rhFactor in allRhFactors)
            {
                var currentStock = products.Count(p => p.BloodGroup.ABO == bloodType && p.BloodGroup.Rh == rhFactor);
                var weeklyUsage = issuedProducts.Count(p => p.BloodGroup.ABO == bloodType && p.BloodGroup.Rh == rhFactor && p.UpdatedAt >= DateTime.UtcNow.AddDays(-7));
                var safetyStock = GetSafetyStockLevel(BloodProductType.RedBloodCells, bloodType, rhFactor, inventorySettings);
                var daysOfSupply = weeklyUsage > 0 ? currentStock * 7 / weeklyUsage : currentStock * 7;
                var status = currentStock < safetyStock ? "Low" : currentStock < safetyStock * 2 ? "Normal" : "Adequate";

                inventoryByType.Add(new BloodTypeInventoryItem(
                    bloodType,
                    rhFactor,
                    currentStock,
                    weeklyUsage,
                    daysOfSupply,
                    safetyStock,
                    status
                ));
            }
        }

        var lowestStockType = inventoryByType
            .OrderBy(i => i.DaysOfSupply)
            .FirstOrDefault();

        var supplyDemandRatios = inventoryByType
            .ToDictionary(
                i => $"{i.BloodType}{(i.RhFactor == RhFactor.Positive ? "+" : "-")}",
                i => i.AverageWeeklyUsage > 0 ? Math.Round((decimal)i.CurrentStock / i.AverageWeeklyUsage, 2) : 999m
            );

        var overallBalanceScore = inventoryByType.Count == 0 ? 0 :
            Math.Round(100m - inventoryByType.Average(i => Math.Abs((decimal)i.CurrentStock - (decimal)i.SafetyStock * 2) / (i.SafetyStock * 2 + 1) * 100), 2);

        var recommendedPriority = lowestStockType != null
            ? $"{lowestStockType.BloodType}{(lowestStockType.RhFactor == RhFactor.Positive ? "+" : "-")}"
            : "O+";

        return new BloodTypeBalanceDto(
            inventoryByType,
            recommendedPriority,
            overallBalanceScore,
            supplyDemandRatios
        );
    }

    public async Task<BloodCollectionPlanDto> GenerateCollectionPlanAsync(CancellationToken cancellationToken = default)
    {
        var balance = await GetBloodTypeBalanceAnalysisAsync(cancellationToken);

        var targets = balance.InventoryByType
            .Where(i => i.DaysOfSupply < 14)
            .OrderBy(i => i.DaysOfSupply)
            .Select(i => new CollectionTarget(
                i.BloodType,
                i.RhFactor,
                Math.Max(10, i.SafetyStock - i.CurrentStock),
                i.DaysOfSupply < 3 ? "High" : i.DaysOfSupply < 7 ? "Medium" : "Low"
            ))
            .ToList();

        var priorityTypes = string.Join(", ", targets
            .Where(t => t.Priority == "High")
            .Select(t => $"{t.BloodType}{(t.RhFactor == RhFactor.Positive ? "+" : "-")}"));

        return new BloodCollectionPlanDto(
            DateTime.UtcNow,
            targets,
            priorityTypes,
            targets.Sum(t => t.TargetUnits),
            $"Based on inventory analysis, priority blood types: {priorityTypes}"
        );
    }

    public async Task<PagedResult<InventoryItemDto>> GetInventoryItemsAsync(SearchInventoryQuery query, CancellationToken cancellationToken = default)
    {
        var queryable = _unitOfWork.BloodProducts.Query().Where(bp => !bp.IsDeleted);

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

        if (!string.IsNullOrEmpty(query.StorageLocation))
        {
            queryable = queryable.Where(bp => bp.StorageLocation!.Contains(query.StorageLocation));
        }

        if (query.ExpiringSoon == true)
        {
            queryable = queryable.Where(bp => bp.ExpiryDate <= DateTime.UtcNow.AddHours(24));
        }

        var totalCount = await queryable.CountAsync(cancellationToken);
        var items = await queryable
            .OrderBy(bp => bp.ExpiryDate)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToInventoryItem).ToList();

        return new PagedResult<InventoryItemDto>(
            dtos,
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<InventoryItemDto?> GetInventoryItemByProductIdAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(productId, cancellationToken);
        return product == null ? null : MapToInventoryItem(product);
    }

    public async Task MarkAsInStockAsync(Guid productId, string storageLocation, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        product.Status = InventoryStatus.InStock;
        product.StorageLocation = storageLocation;
        product.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.BloodProducts.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ReserveProductAsync(Guid productId, DateTime reservedUntil, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        if (product.Status != InventoryStatus.InStock)
        {
            throw new ProductReservedException(productId);
        }

        if (product.ExpiryDate <= DateTime.UtcNow)
        {
            throw new ProductExpiredException(productId, product.ExpiryDate);
        }

        product.Status = InventoryStatus.Reserved;
        product.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.BloodProducts.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ReleaseReservationAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.BloodProducts.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("BloodProduct", productId);

        if (product.Status == InventoryStatus.Reserved)
        {
            product.Status = InventoryStatus.InStock;
            product.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.BloodProducts.Update(product);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task ProcessExpiredProductsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var expiredProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && (bp.Status == InventoryStatus.InStock || bp.Status == InventoryStatus.Reserved)
                && bp.ExpiryDate <= now)
            .ToListAsync(cancellationToken);

        foreach (var product in expiredProducts)
        {
            product.Status = InventoryStatus.ScrapPending;
            product.UpdatedAt = now;
            _unitOfWork.BloodProducts.Update(product);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Processed {Count} expired products", expiredProducts.Count);
    }

    public async Task<IEnumerable<InventoryHistoryDto>> GetInventoryHistoryAsync(DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.ProductionDate >= startDate && bp.ProductionDate <= endDate && !bp.IsDeleted)
            .ToListAsync(cancellationToken);

        var history = products
            .GroupBy(p => new { p.ProductionDate.Date, p.ProductType, p.BloodGroup.ABO, p.BloodGroup.Rh })
            .Select(g => new InventoryHistoryDto(
                g.Key.Date,
                g.Key.ProductType,
                g.Key.ABO,
                g.Key.Rh,
                0,
                g.Count(),
                g.Count(p => p.Status == InventoryStatus.Issued),
                g.Count(p => p.Status == InventoryStatus.Scrapped),
                g.Count()
            ))
            .OrderBy(h => h.Date)
            .ToList();

        return history;
    }

    public async Task<InventoryTrendDto> GetInventoryTrendAsync(int days, CancellationToken cancellationToken = default)
    {
        var startDate = DateTime.UtcNow.AddDays(-days);
        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => bp.ProductionDate >= startDate && !bp.IsDeleted)
            .ToListAsync(cancellationToken);

        var dailyPoints = Enumerable.Range(0, days)
            .Select(i => {
                var date = startDate.AddDays(i).Date;
                var dayProducts = products.Where(p => p.ProductionDate.Date == date);
                return new DailyInventoryPoint(
                    date,
                    dayProducts.Count(),
                    dayProducts.Count(p => p.ExpiryDate <= DateTime.UtcNow.AddHours(24))
                );
            })
            .ToList();

        var avgStock = dailyPoints.Any() ? (decimal)dailyPoints.Average(p => p.TotalUnits) : 0;
        var totalReceived = products.Count;
        var totalIssued = products.Count(p => p.Status == InventoryStatus.Issued);
        var turnoverRate = totalReceived > 0 ? Math.Round((decimal)totalIssued / totalReceived * 100, 2) : 0;

        var recentAvg = dailyPoints.TakeLast(7).Average(p => p.TotalUnits);
        var olderAvg = dailyPoints.Take(7).Average(p => p.TotalUnits);
        var trendDirection = recentAvg > olderAvg ? "Increasing" : recentAvg < olderAvg ? "Decreasing" : "Stable";

        return new InventoryTrendDto(
            dailyPoints,
            avgStock,
            turnoverRate,
            trendDirection
        );
    }

    public async Task SetSafetyStockLevelAsync(BloodProductType productType, BloodType bloodType, RhFactor rhFactor, int minimumLevel, CancellationToken cancellationToken = default)
    {
        var setting = await _unitOfWork.InventorySettings.Query()
            .FirstOrDefaultAsync(s => s.ProductType == productType
                && s.BloodType == bloodType
                && s.RhFactor == rhFactor
                && !s.IsDeleted,
                cancellationToken);

        if (setting == null)
        {
            setting = new InventorySetting
            {
                ProductType = productType,
                BloodType = bloodType,
                RhFactor = rhFactor,
                MinimumLevel = minimumLevel,
                WarningLevel = minimumLevel * 2,
                EmergencyReserve = minimumLevel / 2,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _unitOfWork.InventorySettings.AddAsync(setting, cancellationToken);
        }
        else
        {
            setting.MinimumLevel = minimumLevel;
            setting.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.InventorySettings.Update(setting);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Safety stock level updated for {ProductType} {BloodType}{RhFactor}: {MinimumLevel}",
            productType, bloodType, rhFactor == RhFactor.Positive ? "+" : "-", minimumLevel);
    }

    public async Task<InventorySettingsDto> GetInventorySettingsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await _unitOfWork.InventorySettings.Query()
            .Where(s => !s.IsDeleted)
            .ToListAsync(cancellationToken);

        var levels = settings.Select(s => new SafetyStockLevel(
            s.ProductType,
            s.BloodType,
            s.RhFactor,
            s.MinimumLevel
        )).ToList();

        return new InventorySettingsDto(
            levels,
            ExpirationWarningHours: 24,
            EmergencyReservePercent: 20
        );
    }

    public async Task CheckAndSendAlertsAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting inventory alert check");

        var now = DateTime.UtcNow;
        var alertsSent = 0;

        var lowStockItems = await GetLowStockItemsAsync(cancellationToken);
        foreach (var item in lowStockItems)
        {
            var message = $"Low stock alert: {item.ProductType} {item.BloodType}{(item.RhFactor == RhFactor.Positive ? "+" : "-")} - {item.CurrentStock} units remaining, threshold: {item.SafetyStock}";
            await _notificationService.SendInventoryAlertAsync(
                "LowStock",
                message,
                "High",
                cancellationToken);
            alertsSent++;
        }

        var expiringProducts = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted
                && bp.Status == InventoryStatus.InStock
                && bp.ExpiryDate <= now.AddHours(24)
                && bp.ExpiryDate > now)
            .ToListAsync(cancellationToken);

        foreach (var product in expiringProducts)
        {
            var hoursUntilExpiry = (product.ExpiryDate - now).TotalHours;
            var message = $"Expiring soon: Product {product.ProductCode} expires in {hoursUntilExpiry:F1} hours";
            await _notificationService.SendInventoryAlertAsync(
                "ExpiringSoon",
                message,
                "Critical",
                cancellationToken);
            alertsSent++;
        }

        _logger.LogInformation("Inventory alert check completed. {AlertsSent} alerts sent", alertsSent);
    }

    private async Task<IEnumerable<(BloodProductType ProductType, BloodType BloodType, RhFactor RhFactor, int CurrentStock, int SafetyStock)>> GetLowStockItemsAsync(CancellationToken cancellationToken)
    {
        var settings = await _unitOfWork.InventorySettings.Query()
            .Where(s => !s.IsDeleted)
            .ToListAsync(cancellationToken);

        var products = await _unitOfWork.BloodProducts.Query()
            .Where(bp => !bp.IsDeleted && bp.Status == InventoryStatus.InStock)
            .GroupBy(bp => new { bp.ProductType, bp.BloodGroup.ABO, bp.BloodGroup.Rh })
            .Select(g => new { g.Key.ProductType, g.Key.ABO, g.Key.Rh, Count = g.Count() })
            .ToDictionaryAsync(
                g => (g.ProductType, g.ABO, g.Rh),
                g => g.Count,
                cancellationToken);

        var result = new List<(BloodProductType, BloodType, RhFactor, int, int)>();

        foreach (var setting in settings)
        {
            var key = (setting.ProductType, setting.BloodType, setting.RhFactor);
            var currentStock = products.TryGetValue(key, out var count) ? count : 0;
            if (currentStock < setting.MinimumLevel)
            {
                result.Add((setting.ProductType, setting.BloodType, setting.RhFactor, currentStock, setting.MinimumLevel));
            }
        }

        return result;
    }

    private static int GetSafetyStockLevel(BloodProductType productType, BloodType bloodType, RhFactor rhFactor, Dictionary<(BloodProductType, BloodType, RhFactor), int> settings)
    {
        return settings.TryGetValue((productType, bloodType, rhFactor), out var level) ? level : 10;
    }

    private static InventoryItemDto MapToInventoryItem(BloodProduct product)
    {
        var now = DateTime.UtcNow;
        var daysUntilExpiry = (int)(product.ExpiryDate - now).TotalDays;
        var isExpiringSoon = product.ExpiryDate <= now.AddHours(24) && product.ExpiryDate > now;
        var isExpired = product.ExpiryDate <= now;

        return new InventoryItemDto(
            product.Id,
            product.ProductCode,
            product.ProductType,
            product.BloodGroup.ToString(),
            product.BloodGroup.ABO,
            product.BloodGroup.Rh,
            product.Volume,
            product.ProductionDate,
            product.ExpiryDate,
            daysUntilExpiry,
            product.Status,
            product.StorageLocation,
            isExpiringSoon,
            isExpired
        );
    }
}
