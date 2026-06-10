namespace PotteryStudio.Models;

public enum SalesStatus
{
    Draft,
    Listed,
    Reserved,
    Sold,
    Returned
}

public enum OrderStatus
{
    Pending,
    Quoted,
    Accepted,
    InProgress,
    Completed,
    Cancelled
}

public class SalesItem
{
    public Guid Id { get; set; }
    public Guid PieceId { get; set; }
    public PieceArchive? Piece { get; set; }
    public string? PieceTitle { get; set; }
    public string? PieceImage { get; set; }
    public decimal Price { get; set; }
    public SalesStatus Status { get; set; } = SalesStatus.Draft;
    public DateTime ListedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SoldAt { get; set; }
    public string? BuyerName { get; set; }
    public string? BuyerContact { get; set; }
    public decimal? AuthorShare { get; set; }
    public decimal? StudioShare { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CustomOrder
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string[]? ReferenceImages { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string ClientContact { get; set; } = string.Empty;
    public decimal? Budget { get; set; }
    public Guid? AssignedTo { get; set; }
    public User? AssignedUser { get; set; }
    public string? AssignedToName { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public decimal? QuoteAmount { get; set; }
    public DateTime? QuoteDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? Deadline { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
}

public class RevenueSummary
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal StudioRevenue { get; set; }
    public decimal AuthorRevenue { get; set; }
    public int TotalSales { get; set; }
    public int CustomOrders { get; set; }
    public decimal CustomOrderRevenue { get; set; }
}
