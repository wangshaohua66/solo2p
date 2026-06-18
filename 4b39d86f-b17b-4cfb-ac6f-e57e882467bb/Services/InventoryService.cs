using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Services;

public class InventoryService : IInventoryService
{
    private readonly IBaseRepository<Inventory> _inventoryRepo;
    private readonly IBaseRepository<InventoryTransaction> _transactionRepo;
    private readonly IBaseRepository<Warehouse> _warehouseRepo;
    private readonly IBaseRepository<ChemicalBatch> _batchRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IBaseRepository<Chemical> _chemicalRepo;
    private readonly IAlertService _alertService;
    private readonly IMapper _mapper;

    public InventoryService(
        IBaseRepository<Inventory> inventoryRepo,
        IBaseRepository<InventoryTransaction> transactionRepo,
        IBaseRepository<Warehouse> warehouseRepo,
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IBaseRepository<Chemical> chemicalRepo,
        IAlertService alertService,
        IMapper mapper)
    {
        _inventoryRepo = inventoryRepo;
        _transactionRepo = transactionRepo;
        _warehouseRepo = warehouseRepo;
        _batchRepo = batchRepo;
        _enterpriseRepo = enterpriseRepo;
        _chemicalRepo = chemicalRepo;
        _alertService = alertService;
        _mapper = mapper;
    }

    public async Task<InventoryDto?> GetInventoryByIdAsync(int id)
    {
        var inventory = await _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Warehouse)
            .Include(i => i.Chemical)
            .FirstOrDefaultAsync(i => i.Id == id);

        return inventory != null ? _mapper.Map<InventoryDto>(inventory) : null;
    }

    public async Task<PagedResult<InventoryDto>> GetInventoriesAsync(InventoryQueryDto dto)
    {
        var predicate = PredicateBuilder.True<Inventory>();

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(i => i.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.WarehouseId.HasValue)
            predicate = predicate.And(i => i.WarehouseId == dto.WarehouseId.Value);

        if (dto.ChemicalId.HasValue)
            predicate = predicate.And(i => i.ChemicalId == dto.ChemicalId.Value);

        if (dto.ChemicalCategory.HasValue)
            predicate = predicate.And(i => i.Chemical.Category == (ChemicalCategory)dto.ChemicalCategory.Value);

        if (dto.ChemicalHazardClass.HasValue)
            predicate = predicate.And(i => i.Chemical.HazardClass == (HazardClass)dto.ChemicalHazardClass.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(i => i.Status == (InventoryStatus)dto.Status.Value);

        if (dto.HasAlerts.HasValue)
            predicate = predicate.And(i => i.HasOverstockAlert || i.HasLowStockAlert || i.HasExpiryAlert);

        var result = await _inventoryRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(i => i.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Warehouse)
            .Include(i => i.Chemical)
            .Where(predicate)
            .OrderByDescending(i => i.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<InventoryDto>
        {
            Items = _mapper.Map<List<InventoryDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<InventoryDto> CreateInventoryAsync(InventoryCreateDto dto)
    {
        var exists = await _inventoryRepo.ExistsAsync(i =>
            i.EnterpriseId == dto.EnterpriseId &&
            i.WarehouseId == dto.WarehouseId &&
            i.ChemicalId == dto.ChemicalId);

        if (exists)
            throw new InvalidOperationException("该企业仓库下已存在此危化品的库存记录");

        var inventory = _mapper.Map<Inventory>(dto);
        inventory.Status = InventoryStatus.Normal;
        inventory.CreatedAt = DateTime.UtcNow;
        inventory.UpdatedAt = DateTime.UtcNow;

        var result = await _inventoryRepo.AddAsync(inventory);
        await UpdateInventoryStatusAsync(result.Id);

        return _mapper.Map<InventoryDto>(result);
    }

    public async Task<InventoryDto> UpdateInventoryAsync(int id, InventoryUpdateDto dto)
    {
        var inventory = await _inventoryRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"库存记录不存在: {id}");

        inventory.Quantity = dto.Quantity;
        inventory.ReservedQuantity = dto.ReservedQuantity;
        inventory.MaxCapacity = dto.MaxCapacity;
        inventory.MinSafeQuantity = dto.MinSafeQuantity;
        inventory.ReorderLevel = dto.ReorderLevel;
        inventory.UpdatedAt = DateTime.UtcNow;

        await _inventoryRepo.UpdateAsync(inventory);
        await UpdateInventoryStatusAsync(inventory.Id);

        return _mapper.Map<InventoryDto>(inventory);
    }

    public async Task<bool> DeleteInventoryAsync(int id)
    {
        var inventory = await _inventoryRepo.GetByIdAsync(id);
        if (inventory == null) return false;

        await _inventoryRepo.DeleteAsync(inventory);
        return true;
    }

    public async Task<List<InventoryStatisticsDto>> GetStatisticsAsync(
        int? enterpriseId = null,
        int? warehouseId = null,
        int? category = null)
    {
        var query = _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Warehouse)
            .Include(i => i.Chemical);

        if (enterpriseId.HasValue)
            query = query.Where(i => i.EnterpriseId == enterpriseId.Value);

        if (warehouseId.HasValue)
            query = query.Where(i => i.WarehouseId == warehouseId.Value);

        if (category.HasValue)
            query = query.Where(i => i.Chemical.Category == (ChemicalCategory)category.Value);

        var inventories = await query.ToListAsync();

        var statistics = inventories
            .GroupBy(i => new { i.EnterpriseId, i.WarehouseId, i.Chemical.Category })
            .Select(g => new InventoryStatisticsDto
            {
                EnterpriseId = g.Key.EnterpriseId,
                EnterpriseName = g.First().Enterprise.Name,
                WarehouseId = g.Key.WarehouseId,
                WarehouseName = g.First().Warehouse.Name,
                ChemicalCategory = (int)g.Key.Category,
                ChemicalCategoryName = g.Key.Category.ToString(),
                TotalQuantity = g.Sum(i => i.Quantity),
                BatchCount = g.Count(),
                OverstockCount = g.Count(i => i.HasOverstockAlert),
                LowStockCount = g.Count(i => i.HasLowStockAlert),
                NearExpiryCount = g.Count(i => i.Status == InventoryStatus.NearExpiry),
                ExpiredCount = g.Count(i => i.Status == InventoryStatus.Expired)
            })
            .ToList();

        return statistics;
    }

    public async Task<InventoryTransactionDto> CreateTransactionAsync(InventoryTransactionCreateDto dto)
    {
        var inventory = await _inventoryRepo.GetByIdAsync(dto.InventoryId) ??
            throw new KeyNotFoundException($"库存记录不存在: {dto.InventoryId}");

        var batch = dto.ChemicalBatchId.HasValue
            ? await _batchRepo.GetByIdAsync(dto.ChemicalBatchId.Value)
            : null;

        var transactionType = (InventoryTransactionType)dto.TransactionType;
        var quantityChange = transactionType switch
        {
            InventoryTransactionType.RawMaterialInbound or
            InventoryTransactionType.FinishedGoodsInbound or
            InventoryTransactionType.ReturnInbound or
            InventoryTransactionType.TransferIn => dto.Quantity,
            InventoryTransactionType.ProductionInput or
            InventoryTransactionType.SalesOutbound or
            InventoryTransactionType.Scrap or
            InventoryTransactionType.TransferOut => -dto.Quantity,
            _ => 0
        };

        var balanceBefore = inventory.Quantity;
        var balanceAfter = balanceBefore + quantityChange;

        if (balanceAfter < 0)
            throw new InvalidOperationException("库存不足，无法执行此操作");

        var transaction = new InventoryTransaction
        {
            InventoryId = dto.InventoryId,
            ChemicalBatchId = dto.ChemicalBatchId,
            EnterpriseId = inventory.EnterpriseId,
            WarehouseId = inventory.WarehouseId,
            ChemicalId = inventory.ChemicalId,
            TransactionType = transactionType,
            Quantity = dto.Quantity,
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            Unit = dto.Unit,
            Remark = dto.Remark,
            OperatorId = dto.OperatorId,
            OperatorName = dto.OperatorName,
            TransactionTime = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        inventory.Quantity = balanceAfter;
        inventory.UpdatedAt = DateTime.UtcNow;

        var warehouse = await _warehouseRepo.GetByIdAsync(inventory.WarehouseId);
        if (warehouse != null)
        {
            warehouse.CurrentUsedCapacity += quantityChange;
            warehouse.UpdatedAt = DateTime.UtcNow;
            await _warehouseRepo.UpdateAsync(warehouse);
        }

        var result = await _transactionRepo.AddAsync(transaction);
        await _inventoryRepo.UpdateAsync(inventory);
        await UpdateInventoryStatusAsync(inventory.Id);

        return _mapper.Map<InventoryTransactionDto>(result);
    }

    public async Task<PagedResult<InventoryTransactionDto>> GetTransactionsAsync(InventoryTransactionQueryDto dto)
    {
        var predicate = PredicateBuilder.True<InventoryTransaction>();

        if (dto.InventoryId.HasValue)
            predicate = predicate.And(t => t.InventoryId == dto.InventoryId.Value);

        if (dto.ChemicalBatchId.HasValue)
            predicate = predicate.And(t => t.ChemicalBatchId == dto.ChemicalBatchId.Value);

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(t => t.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.WarehouseId.HasValue)
            predicate = predicate.And(t => t.WarehouseId == dto.WarehouseId.Value);

        if (dto.ChemicalId.HasValue)
            predicate = predicate.And(t => t.ChemicalId == dto.ChemicalId.Value);

        if (dto.TransactionType.HasValue)
            predicate = predicate.And(t => t.TransactionType == (InventoryTransactionType)dto.TransactionType.Value);

        if (dto.TransactionDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(t => t.TransactionTime >= dto.TransactionDateRange.StartDate.Value);

        if (dto.TransactionDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(t => t.TransactionTime < dto.TransactionDateRange.EndDate.Value.AddDays(1));

        var result = await _transactionRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(t => t.TransactionTime),
            dto.PageIndex,
            dto.PageSize);

        var items = await _transactionRepo.GetQueryable()
            .Include(t => t.Inventory)
            .Include(t => t.ChemicalBatch)
            .Include(t => t.Enterprise)
            .Include(t => t.Warehouse)
            .Include(t => t.Chemical)
            .Where(predicate)
            .OrderByDescending(t => t.TransactionTime)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<InventoryTransactionDto>
        {
            Items = _mapper.Map<List<InventoryTransactionDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task UpdateInventoryStatusAsync(int inventoryId)
    {
        var inventory = await _inventoryRepo.GetByIdAsync(inventoryId);
        if (inventory == null) return;

        var batches = await _batchRepo.GetListAsync(b =>
            b.WarehouseId == inventory.WarehouseId &&
            b.ChemicalId == inventory.ChemicalId &&
            b.Status == BatchStatus.InStorage);

        if (batches.Any())
        {
            inventory.EarliestExpiryDate = batches.Min(b => b.ExpiryDate);
        }

        await _inventoryRepo.UpdateAsync(inventory);
        await _alertService.CheckAndGenerateInventoryAlertsAsync();
    }

    public async Task<WarehouseDto?> GetWarehouseByIdAsync(int id)
    {
        var warehouse = await _warehouseRepo.GetQueryable()
            .Include(w => w.Enterprise)
            .FirstOrDefaultAsync(w => w.Id == id);

        return warehouse != null ? _mapper.Map<WarehouseDto>(warehouse) : null;
    }

    public async Task<PagedResult<WarehouseDto>> GetWarehousesAsync(
        int? enterpriseId = null,
        int pageIndex = 1,
        int pageSize = 20)
    {
        var predicate = PredicateBuilder.True<Warehouse>()
            .And(w => w.IsActive);

        if (enterpriseId.HasValue)
            predicate = predicate.And(w => w.EnterpriseId == enterpriseId.Value);

        var result = await _warehouseRepo.GetPagedAsync(
            predicate,
            q => q.OrderBy(w => w.Name),
            pageIndex,
            pageSize);

        var items = await _warehouseRepo.GetQueryable()
            .Include(w => w.Enterprise)
            .Where(predicate)
            .OrderBy(w => w.Name)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<WarehouseDto>
        {
            Items = _mapper.Map<List<WarehouseDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
    }

    public async Task<WarehouseDto> CreateWarehouseAsync(WarehouseCreateDto dto)
    {
        var exists = await _warehouseRepo.ExistsAsync(w => w.Code == dto.Code);
        if (exists)
            throw new InvalidOperationException($"仓库编码已存在: {dto.Code}");

        var warehouse = _mapper.Map<Warehouse>(dto);
        warehouse.CreatedAt = DateTime.UtcNow;
        warehouse.UpdatedAt = DateTime.UtcNow;

        var result = await _warehouseRepo.AddAsync(warehouse);
        return _mapper.Map<WarehouseDto>(result);
    }

    public async Task<WarehouseDto> UpdateWarehouseAsync(int id, WarehouseUpdateDto dto)
    {
        var warehouse = await _warehouseRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"仓库不存在: {id}");

        _mapper.Map(dto, warehouse);
        warehouse.UpdatedAt = DateTime.UtcNow;

        await _warehouseRepo.UpdateAsync(warehouse);
        return _mapper.Map<WarehouseDto>(warehouse);
    }
}
