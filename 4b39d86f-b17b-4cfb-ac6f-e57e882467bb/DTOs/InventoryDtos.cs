namespace HazChemSupervision.DTOs;

public class InventoryDto
{
    public int Id { get; set; }
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public int ChemicalId { get; set; }
    public string ChemicalName { get; set; } = string.Empty;
    public string ChemicalCasNo { get; set; } = string.Empty;
    public int ChemicalCategory { get; set; }
    public string ChemicalCategoryName { get; set; } = string.Empty;
    public int ChemicalHazardClass { get; set; }
    public string ChemicalHazardClassName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal ReservedQuantity { get; set; }
    public decimal AvailableQuantity => Quantity - ReservedQuantity;
    public string Unit { get; set; } = string.Empty;
    public decimal MaxCapacity { get; set; }
    public decimal MinSafeQuantity { get; set; }
    public decimal ReorderLevel { get; set; }
    public DateTime? EarliestExpiryDate { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public bool HasOverstockAlert { get; set; }
    public bool HasLowStockAlert { get; set; }
    public bool HasExpiryAlert { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class InventoryCreateDto
{
    public int EnterpriseId { get; set; }
    public int WarehouseId { get; set; }
    public int ChemicalId { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal MaxCapacity { get; set; }
    public decimal MinSafeQuantity { get; set; }
    public decimal ReorderLevel { get; set; }
}

public class InventoryUpdateDto
{
    public decimal Quantity { get; set; }
    public decimal ReservedQuantity { get; set; }
    public decimal MaxCapacity { get; set; }
    public decimal MinSafeQuantity { get; set; }
    public decimal ReorderLevel { get; set; }
}

public class InventoryQueryDto : PagedRequest
{
    public int? EnterpriseId { get; set; }
    public int? WarehouseId { get; set; }
    public int? ChemicalId { get; set; }
    public int? ChemicalCategory { get; set; }
    public int? ChemicalHazardClass { get; set; }
    public int? Status { get; set; }
    public bool? HasAlerts { get; set; }
}

public class InventoryStatisticsDto
{
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public int ChemicalCategory { get; set; }
    public string ChemicalCategoryName { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public int BatchCount { get; set; }
    public int OverstockCount { get; set; }
    public int LowStockCount { get; set; }
    public int NearExpiryCount { get; set; }
    public int ExpiredCount { get; set; }
}

public class InventoryTransactionDto
{
    public long Id { get; set; }
    public int InventoryId { get; set; }
    public int? ChemicalBatchId { get; set; }
    public string? BatchNo { get; set; }
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public int ChemicalId { get; set; }
    public string ChemicalName { get; set; } = string.Empty;
    public int TransactionType { get; set; }
    public string TransactionTypeName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Remark { get; set; }
    public int OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
    public DateTime TransactionTime { get; set; }
}

public class InventoryTransactionCreateDto
{
    public int InventoryId { get; set; }
    public int? ChemicalBatchId { get; set; }
    public int EnterpriseId { get; set; }
    public int WarehouseId { get; set; }
    public int ChemicalId { get; set; }
    public int TransactionType { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Remark { get; set; }
    public int OperatorId { get; set; }
    public string OperatorName { get; set; } = string.Empty;
}

public class InventoryTransactionQueryDto : PagedRequest
{
    public int? InventoryId { get; set; }
    public int? ChemicalBatchId { get; set; }
    public int? EnterpriseId { get; set; }
    public int? WarehouseId { get; set; }
    public int? ChemicalId { get; set; }
    public int? TransactionType { get; set; }
    public DateRangeFilter? TransactionDateRange { get; set; }
}

public class WarehouseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public int Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public int FireRatingLevel { get; set; }
    public decimal MaxCapacity { get; set; }
    public decimal CurrentUsedCapacity { get; set; }
    public decimal UsageRate => MaxCapacity > 0 ? (CurrentUsedCapacity / MaxCapacity) * 100 : 0;
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public int AllowedHazardClass { get; set; }
    public string AllowedHazardClassName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WarehouseCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string Address { get; set; } = string.Empty;
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public int Type { get; set; }
    public int FireRatingLevel { get; set; }
    public decimal MaxCapacity { get; set; }
    public int AllowedHazardClass { get; set; }
    public bool IsActive { get; set; } = true;
}

public class WarehouseUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public int Type { get; set; }
    public int FireRatingLevel { get; set; }
    public decimal MaxCapacity { get; set; }
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public int AllowedHazardClass { get; set; }
    public bool IsActive { get; set; }
}
