namespace PotteryStudio.Models;

public enum MaterialCategory
{
    Clay,
    Glaze,
    Colorant,
    Tool,
    Other
}

public enum TransactionType
{
    Purchase,
    Usage,
    Adjustment,
    Return
}

public class Material
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public MaterialCategory Category { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public decimal ReservedQuantity { get; set; }
    public decimal AvailableQuantity { get; set; }
    public decimal MinThreshold { get; set; }
    public decimal UnitPrice { get; set; }
    public DateTime? LastRestocked { get; set; }
    public DateTime? LastUsed { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<MaterialTransaction> Transactions { get; set; } = new List<MaterialTransaction>();
}

public class MaterialTransaction
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public Material? Material { get; set; }
    public string? MaterialName { get; set; }
    public TransactionType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
    public string? CreatedByName { get; set; }
}

public class MaterialAlert
{
    public Guid Id { get; set; }
    public Guid MaterialId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public decimal CurrentQuantity { get; set; }
    public decimal Threshold { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
    public decimal? SuggestedPurchaseAmount { get; set; }
    public decimal? EstimatedCost { get; set; }
}

public class PurchaseSuggestion
{
    public Guid MaterialId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public decimal SuggestedQuantity { get; set; }
    public decimal EstimatedCost { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal Threshold { get; set; }
}
