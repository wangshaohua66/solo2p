using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class SalesService : ISalesService
{
    private readonly AppDbContext _context;

    public SalesService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<SalesItem>> GetSalesItemsAsync(PagedQuery query, SalesStatus? status = null)
    {
        var queryable = _context.SalesItems
            .Include(s => s.Piece)
            .AsQueryable();

        if (status.HasValue)
            queryable = queryable.Where(s => s.Status == status.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(s => 
                s.PieceTitle.ToLower().Contains(keyword) ||
                s.BuyerName.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(s => s.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<SalesItem?> GetSalesItemByIdAsync(Guid id)
    {
        return await _context.SalesItems
            .Include(s => s.Piece)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<SalesItem> CreateSalesItemAsync(SalesItem item)
    {
        var piece = await _context.PieceArchives.FindAsync(item.PieceId);
        if (piece == null)
            throw new InvalidOperationException("作品不存在");

        item.Id = Guid.NewGuid();
        item.PieceTitle = piece.Title;
        item.Status = SalesStatus.Draft;
        item.CreatedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;

        CalculateShares(item, piece);

        _context.SalesItems.Add(item);
        await _context.SaveChangesAsync();
        return item;
    }

    public async Task<SalesItem> UpdateSalesItemAsync(Guid id, SalesItem item)
    {
        var existing = await _context.SalesItems.FindAsync(id)
            ?? throw new InvalidOperationException("销售记录不存在");

        existing.Price = item.Price;
        existing.Status = item.Status;
        existing.UpdatedAt = DateTime.UtcNow;

        if (existing.Piece != null)
        {
            CalculateShares(existing, existing.Piece);
        }

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteSalesItemAsync(Guid id)
    {
        var item = await _context.SalesItems.FindAsync(id)
            ?? throw new InvalidOperationException("销售记录不存在");

        if (item.Status == SalesStatus.Sold)
            throw new InvalidOperationException("已售出的商品无法删除");

        _context.SalesItems.Remove(item);
        await _context.SaveChangesAsync();
    }

    public async Task<SalesItem> MarkAsSoldAsync(Guid id, string buyerName, string buyerContact)
    {
        var item = await _context.SalesItems.FindAsync(id)
            ?? throw new InvalidOperationException("销售记录不存在");

        if (item.Status != SalesStatus.Listed)
            throw new InvalidOperationException("只有上架的商品才能标记为售出");

        item.Status = SalesStatus.Sold;
        item.SoldAt = DateTime.UtcNow;
        item.BuyerName = buyerName;
        item.BuyerContact = buyerContact;
        item.UpdatedAt = DateTime.UtcNow;

        if (item.PieceId.HasValue)
        {
            var piece = await _context.PieceArchives.FindAsync(item.PieceId.Value);
            if (piece != null)
            {
                piece.IsForSale = false;
                piece.UpdatedAt = DateTime.UtcNow;
            }
        }

        if (item.Piece != null && item.Piece.MemberId.HasValue)
        {
            var member = await _context.Users.FindAsync(item.Piece.MemberId.Value);
            if (member != null && item.AuthorShare.HasValue)
            {
                member.TotalSpent += 0;
                member.Points += (int)(item.AuthorShare.Value / 10);
                member.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return item;
    }

    public async Task<PagedResult<CustomOrder>> GetCustomOrdersAsync(PagedQuery query, OrderStatus? status = null)
    {
        var queryable = _context.CustomOrders.AsQueryable();

        if (status.HasValue)
            queryable = queryable.Where(o => o.Status == status.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(o => 
                o.Title.ToLower().Contains(keyword) ||
                o.ClientName.ToLower().Contains(keyword) ||
                o.Description.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(o => o.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<CustomOrder?> GetCustomOrderByIdAsync(Guid id)
    {
        return await _context.CustomOrders
            .Include(o => o.AssignedUser)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<CustomOrder> CreateCustomOrderAsync(CustomOrder order)
    {
        order.Id = Guid.NewGuid();
        order.Status = OrderStatus.Pending;
        order.CreatedAt = DateTime.UtcNow;

        _context.CustomOrders.Add(order);
        await _context.SaveChangesAsync();
        return order;
    }

    public async Task<CustomOrder> UpdateCustomOrderAsync(Guid id, CustomOrder order)
    {
        var existing = await _context.CustomOrders.FindAsync(id)
            ?? throw new InvalidOperationException("定制单不存在");

        existing.Title = order.Title;
        existing.Description = order.Description;
        existing.ReferenceImages = order.ReferenceImages;
        existing.ClientName = order.ClientName;
        existing.ClientContact = order.ClientContact;
        existing.Budget = order.Budget;
        existing.AssignedTo = order.AssignedTo;
        existing.AssignedToName = order.AssignedToName;
        existing.Deadline = order.Deadline;
        existing.Notes = order.Notes;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task<CustomOrder> UpdateStatusAsync(Guid id, OrderStatus status)
    {
        var order = await _context.CustomOrders.FindAsync(id)
            ?? throw new InvalidOperationException("定制单不存在");

        order.Status = status;

        if (status == OrderStatus.Completed)
            order.CompletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return order;
    }

    public async Task<CustomOrder> SubmitQuoteAsync(Guid id, decimal quoteAmount)
    {
        var order = await _context.CustomOrders.FindAsync(id)
            ?? throw new InvalidOperationException("定制单不存在");

        if (order.Status != OrderStatus.Pending)
            throw new InvalidOperationException("只有待处理的订单可以报价");

        order.QuoteAmount = quoteAmount;
        order.QuoteDate = DateTime.UtcNow;
        order.Status = OrderStatus.Quoted;

        await _context.SaveChangesAsync();
        return order;
    }

    private static void CalculateShares(SalesItem item, PieceArchive piece)
    {
        var authorShareRate = piece.MemberTier switch
        {
            MemberTier.Yearly => 0.7m,
            MemberTier.Quarterly => 0.6m,
            MemberTier.Monthly => 0.5m,
            _ => 0.4m
        };

        item.AuthorShare = item.Price * authorShareRate;
        item.StudioShare = item.Price * (1 - authorShareRate);
    }
}
