using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _context;

    public InventoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<Material>> GetMaterialsAsync(PagedQuery query, MaterialCategory? category = null)
    {
        var queryable = _context.Materials.AsQueryable();

        if (category.HasValue)
            queryable = queryable.Where(m => m.Category == category.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(m => 
                m.Name.ToLower().Contains(keyword) ||
                m.Description.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderBy(m => m.Name)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<Material?> GetMaterialByIdAsync(Guid id)
    {
        return await _context.Materials
            .Include(m => m.Transactions)
            .FirstOrDefaultAsync(m => m.Id == id);
    }

    public async Task<Material> CreateMaterialAsync(Material material)
    {
        material.Id = Guid.NewGuid();
        material.AvailableQuantity = material.TotalQuantity - material.ReservedQuantity;
        material.CreatedAt = DateTime.UtcNow;
        material.UpdatedAt = DateTime.UtcNow;

        _context.Materials.Add(material);

        if (material.AvailableQuantity <= material.MinThreshold)
        {
            await CreateAlertAsync(material);
        }

        await _context.SaveChangesAsync();
        return material;
    }

    public async Task<Material> UpdateMaterialAsync(Guid id, Material material)
    {
        var existing = await _context.Materials.FindAsync(id)
            ?? throw new InvalidOperationException("原料不存在");

        existing.Name = material.Name;
        existing.Category = material.Category;
        existing.Unit = material.Unit;
        existing.MinThreshold = material.MinThreshold;
        existing.UnitPrice = material.UnitPrice;
        existing.Description = material.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        if (existing.AvailableQuantity <= existing.MinThreshold)
        {
            await CreateAlertAsync(existing);
        }

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteMaterialAsync(Guid id)
    {
        var material = await _context.Materials.FindAsync(id)
            ?? throw new InvalidOperationException("原料不存在");

        _context.Materials.Remove(material);
        await _context.SaveChangesAsync();
    }

    public async Task<PagedResult<MaterialTransaction>> GetTransactionsAsync(
        PagedQuery query,
        Guid? materialId = null,
        TransactionType? type = null)
    {
        var queryable = _context.MaterialTransactions.AsQueryable();

        if (materialId.HasValue)
            queryable = queryable.Where(t => t.MaterialId == materialId.Value);

        if (type.HasValue)
            queryable = queryable.Where(t => t.Type == type.Value);

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(t => t.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<MaterialTransaction> AddTransactionAsync(MaterialTransaction transaction)
    {
        var material = await _context.Materials.FindAsync(transaction.MaterialId)
            ?? throw new InvalidOperationException("原料不存在");

        transaction.Id = Guid.NewGuid();
        transaction.MaterialName = material.Name;
        transaction.CreatedAt = DateTime.UtcNow;
        transaction.TotalAmount = transaction.Quantity * transaction.UnitPrice;

        switch (transaction.Type)
        {
            case TransactionType.Purchase:
                material.TotalQuantity += transaction.Quantity;
                material.AvailableQuantity += transaction.Quantity;
                material.LastRestocked = DateTime.UtcNow;
                break;
            case TransactionType.Usage:
                if (material.AvailableQuantity < transaction.Quantity)
                    throw new InvalidOperationException("库存不足");
                material.TotalQuantity -= transaction.Quantity;
                material.AvailableQuantity -= transaction.Quantity;
                material.LastUsed = DateTime.UtcNow;
                break;
            case TransactionType.Adjustment:
                material.TotalQuantity = transaction.Quantity;
                material.AvailableQuantity = Math.Max(0, transaction.Quantity - material.ReservedQuantity);
                break;
            case TransactionType.Return:
                material.TotalQuantity += transaction.Quantity;
                material.AvailableQuantity += transaction.Quantity;
                break;
        }

        material.UpdatedAt = DateTime.UtcNow;
        _context.MaterialTransactions.Add(transaction);

        if (material.AvailableQuantity <= material.MinThreshold)
        {
            await CreateAlertAsync(material);
        }

        await _context.SaveChangesAsync();
        return transaction;
    }

    public async Task<List<MaterialAlert>> GetAlertsAsync(bool? isRead = null)
    {
        var query = _context.MaterialAlerts.AsQueryable();
        
        if (isRead.HasValue)
            query = query.Where(a => a.IsRead == isRead.Value);

        return await query
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task MarkAlertAsReadAsync(Guid alertId)
    {
        var alert = await _context.MaterialAlerts.FindAsync(alertId);
        if (alert != null)
        {
            alert.IsRead = true;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<List<PurchaseSuggestion>> GeneratePurchaseSuggestionsAsync()
    {
        var lowStockMaterials = await _context.Materials
            .Where(m => m.AvailableQuantity <= m.MinThreshold)
            .ToListAsync();

        var suggestions = new List<PurchaseSuggestion>();
        foreach (var material in lowStockMaterials)
        {
            var suggestedQuantity = material.MinThreshold * 2 - material.AvailableQuantity;
            if (suggestedQuantity > 0)
            {
                suggestions.Add(new PurchaseSuggestion
                {
                    MaterialId = material.Id,
                    MaterialName = material.Name,
                    SuggestedQuantity = Math.Ceiling(suggestedQuantity),
                    EstimatedCost = Math.Ceiling(suggestedQuantity) * material.UnitPrice,
                    CurrentStock = material.AvailableQuantity,
                    Threshold = material.MinThreshold
                });
            }
        }

        return suggestions;
    }

    public async Task CheckInventoryAlertsAsync()
    {
        var lowStockMaterials = await _context.Materials
            .Where(m => m.AvailableQuantity <= m.MinThreshold)
            .ToListAsync();

        foreach (var material in lowStockMaterials)
        {
            var recentAlert = await _context.MaterialAlerts
                .OrderByDescending(a => a.CreatedAt)
                .FirstOrDefaultAsync(a => a.MaterialId == material.Id 
                    && a.CreatedAt >= DateTime.UtcNow.AddDays(-1));

            if (recentAlert == null)
            {
                await CreateAlertAsync(material);
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeductMaterialForPieceAsync(Guid pieceId, Dictionary<Guid, decimal> materialUsage)
    {
        var piece = await _context.PieceArchives.FindAsync(pieceId);
        if (piece == null) return;

        foreach (var usage in materialUsage)
        {
            var material = await _context.Materials.FindAsync(usage.Key);
            if (material != null && material.AvailableQuantity >= usage.Value)
            {
                var transaction = new MaterialTransaction
                {
                    Id = Guid.NewGuid(),
                    MaterialId = usage.Key,
                    MaterialName = material.Name,
                    Type = TransactionType.Usage,
                    Quantity = usage.Value,
                    UnitPrice = material.UnitPrice,
                    TotalAmount = usage.Value * material.UnitPrice,
                    ReferenceType = "Piece",
                    ReferenceId = pieceId,
                    Notes = $"作品 {piece.Title} 制作消耗",
                    CreatedAt = DateTime.UtcNow
                };

                material.TotalQuantity -= usage.Value;
                material.AvailableQuantity -= usage.Value;
                material.LastUsed = DateTime.UtcNow;
                material.UpdatedAt = DateTime.UtcNow;

                _context.MaterialTransactions.Add(transaction);

                if (material.AvailableQuantity <= material.MinThreshold)
                {
                    await CreateAlertAsync(material);
                }
            }
        }

        await _context.SaveChangesAsync();
    }

    private async Task CreateAlertAsync(Material material)
    {
        var suggestedAmount = material.MinThreshold * 2 - material.AvailableQuantity;
        
        var alert = new MaterialAlert
        {
            Id = Guid.NewGuid(),
            MaterialId = material.Id,
            MaterialName = material.Name,
            CurrentQuantity = material.AvailableQuantity,
            Threshold = material.MinThreshold,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            SuggestedPurchaseAmount = suggestedAmount > 0 ? suggestedAmount : null,
            EstimatedCost = suggestedAmount > 0 ? suggestedAmount * material.UnitPrice : null
        };

        _context.MaterialAlerts.Add(alert);

        var admins = await _context.Users
            .Where(u => u.Role == UserRole.Admin && u.IsActive)
            .ToListAsync();

        foreach (var admin in admins)
        {
            _context.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = admin.Id,
                Title = "原料库存预警",
                Content = $"原料 {material.Name} 库存不足，当前库存 {material.AvailableQuantity}{material.Unit}，低于阈值 {material.MinThreshold}{material.Unit}",
                Type = NotificationType.Inventory,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                Link = "/inventory/alerts"
            });
        }
    }
}
