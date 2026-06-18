using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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
    private readonly IConfiguration _configuration;
    private readonly IMapper _mapper;

    public InventoryService(
        IBaseRepository<Inventory> inventoryRepo,
        IBaseRepository<InventoryTransaction> transactionRepo,
        IBaseRepository<Warehouse> warehouseRepo,
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IBaseRepository<Chemical> chemicalRepo,
        IAlertService alertService,
        IConfiguration configuration,
        IMapper mapper)
    {
        _inventoryRepo = inventoryRepo;
        _transactionRepo = transactionRepo;
        _warehouseRepo = warehouseRepo;
        _batchRepo = batchRepo;
        _enterpriseRepo = enterpriseRepo;
        _chemicalRepo = chemicalRepo;
        _alertService = alertService;
        _configuration = configuration;
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

        try
        {
            await _inventoryRepo.UpdateAsync(inventory);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new InvalidOperationException("库存记录已被其他用户修改，请刷新后重试", ex);
        }

        await UpdateInventoryStatusAsync(inventory.Id);

        return _mapper.Map<InventoryDto>(inventory);
    }

    public async Task<bool> DeleteInventoryAsync(int id)
    {
        var inventory = await _inventoryRepo.GetByIdAsync(id);
        if (inventory == null) return false;

        try
        {
            await _inventoryRepo.DeleteAsync(inventory);
            return true;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new InvalidOperationException("库存记录已被其他用户修改，请刷新后重试", ex);
        }
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
        if (dto.Quantity <= 0)
            throw new ArgumentException("交易数量必须大于0", nameof(dto.Quantity));

        Inventory? inventory = null;

        if (dto.InventoryId > 0)
        {
            inventory = await _inventoryRepo.GetByIdAsync(dto.InventoryId) ??
                throw new KeyNotFoundException($"库存记录不存在: {dto.InventoryId}");
        }
        else
        {
            if (dto.EnterpriseId <= 0 || dto.WarehouseId <= 0 || dto.ChemicalId <= 0)
                throw new ArgumentException("当InventoryId为0时，必须提供有效的EnterpriseId、WarehouseId和ChemicalId");

            inventory = await _inventoryRepo.GetQueryable()
                .FirstOrDefaultAsync(i =>
                    i.EnterpriseId == dto.EnterpriseId &&
                    i.WarehouseId == dto.WarehouseId &&
                    i.ChemicalId == dto.ChemicalId);

            if (inventory == null)
                throw new KeyNotFoundException($"未找到对应库存记录，请先创建库存（企业:{dto.EnterpriseId},仓库:{dto.WarehouseId},危化品:{dto.ChemicalId}）");
        }

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
            _ => throw new ArgumentException($"不支持的交易类型: {dto.TransactionType}")
        };

        var balanceBefore = inventory.Quantity;
        var balanceAfter = balanceBefore + quantityChange;

        if (balanceAfter < 0)
            throw new InvalidOperationException($"库存不足，无法执行此操作（当前库存:{balanceBefore},出库数量:{dto.Quantity}）");

        using var retry = new RetryHelper(3, TimeSpan.FromMilliseconds(100));
        await retry.ExecuteAsync(async () =>
        {
            var transaction = new InventoryTransaction
            {
                InventoryId = inventory.Id,
                ChemicalBatchId = dto.ChemicalBatchId,
                EnterpriseId = inventory.EnterpriseId,
                WarehouseId = inventory.WarehouseId,
                ChemicalId = inventory.ChemicalId,
                TransactionType = transactionType,
                Quantity = dto.Quantity,
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Unit = dto.Unit ?? inventory.Unit,
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

            await _transactionRepo.AddAsync(transaction);

            try
            {
                await _inventoryRepo.UpdateAsync(inventory);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                inventory = await _inventoryRepo.GetByIdAsync(inventory.Id) ??
                    throw new InvalidOperationException("库存记录在操作期间被删除", ex);
                throw;
            }
        });

        await UpdateInventoryStatusAsync(inventory.Id);

        var savedTransaction = await _transactionRepo.GetQueryable()
            .Include(t => t.Inventory)
            .Include(t => t.ChemicalBatch)
            .Include(t => t.Enterprise)
            .Include(t => t.Warehouse)
            .Include(t => t.Chemical)
            .OrderByDescending(t => t.Id)
            .FirstOrDefaultAsync(t => t.InventoryId == inventory.Id);

        return _mapper.Map<InventoryTransactionDto>(savedTransaction);
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

        var nearExpiryDays = _configuration.GetValue<int>("Alert:NearExpiryDays", 30);
        var expiryThreshold = DateTime.UtcNow.AddDays(nearExpiryDays);

        var batchesQuery = _batchRepo.GetQueryable()
            .Where(b =>
                b.WarehouseId == inventory.WarehouseId &&
                b.ChemicalId == inventory.ChemicalId &&
                b.Status == BatchStatus.InStorage);

        var minExpiry = await batchesQuery.MinAsync(b => (DateTime?)b.ExpiryDate);
        inventory.EarliestExpiryDate = minExpiry;

        inventory.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _inventoryRepo.UpdateAsync(inventory);
        }
        catch (DbUpdateConcurrencyException)
        {
        }

        await _alertService.CheckAndGenerateInventoryAlertsAsync();
    }

    public async Task<List<InventoryDto>> GetAlertInventoriesAsync(int? enterpriseId = null)
    {
        var nearExpiryDays = _configuration.GetValue<int>("Alert:NearExpiryDays", 30);
        var overstockThreshold = _configuration.GetValue<decimal>("Alert:InventoryOverstockThreshold", 0.9m);
        var lowStockThreshold = _configuration.GetValue<decimal>("Alert:InventoryLowStockThreshold", 0.1m);
        var now = DateTime.UtcNow;
        var expiryDate = now.AddDays(nearExpiryDays);

        var query = _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Warehouse)
            .Include(i => i.Chemical)
            .Where(i =>
                (i.MaxCapacity > 0 && i.Quantity / i.MaxCapacity >= overstockThreshold) ||
                i.Quantity <= i.MinSafeQuantity ||
                (i.EarliestExpiryDate.HasValue && i.EarliestExpiryDate.Value <= expiryDate));

        if (enterpriseId.HasValue)
            query = query.Where(i => i.EnterpriseId == enterpriseId.Value);

        var inventories = await query
            .OrderByDescending(i => i.UpdatedAt)
            .Take(1000)
            .ToListAsync();

        return _mapper.Map<List<InventoryDto>>(inventories);
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

public class RetryHelper : IDisposable
{
    private readonly int _maxRetries;
    private readonly TimeSpan _delay;
    private int _retries;

    public RetryHelper(int maxRetries, TimeSpan delay)
    {
        _maxRetries = maxRetries;
        _delay = delay;
        _retries = 0;
    }

    public async Task ExecuteAsync(Func<Task> operation)
    {
        while (true)
        {
            try
            {
                await operation();
                return;
            }
            catch (DbUpdateConcurrencyException)
            {
                _retries++;
                if (_retries >= _maxRetries)
                    throw new InvalidOperationException($"库存操作并发冲突，已重试{_maxRetries}次仍失败");
                await Task.Delay(_delay * _retries);
            }
        }
    }

    public void Dispose() { }
}
