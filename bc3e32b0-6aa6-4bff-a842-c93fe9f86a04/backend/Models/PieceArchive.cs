namespace PotteryStudio.Models;

public enum PhotoStage
{
    Clay,
    Bisque,
    Glaze,
    Finished
}

public enum PieceStatus
{
    Clay,
    Bisque,
    Glazed,
    Fired,
    Completed,
    Sold
}

public class PiecePhoto
{
    public Guid Id { get; set; }
    public Guid PieceId { get; set; }
    public PhotoStage Stage { get; set; }
    public string Url { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class PieceArchive
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid MemberId { get; set; }
    public User? Member { get; set; }
    public string? MemberName { get; set; }
    public Guid? GlazeRecipeId { get; set; }
    public GlazeRecipe? GlazeRecipe { get; set; }
    public string? GlazeRecipeName { get; set; }
    public Guid? KilnScheduleId { get; set; }
    public KilnSchedule? KilnSchedule { get; set; }
    public string? KilnScheduleName { get; set; }
    public MemberTier MemberTier { get; set; } = MemberTier.Experience;
    public PieceStatus Status { get; set; } = PieceStatus.Clay;
    public decimal? Weight { get; set; }
    public decimal? Height { get; set; }
    public decimal? Width { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public bool IsForSale { get; set; }
    public decimal? Price { get; set; }
    public string[]? Tags { get; set; }

    public ICollection<PiecePhoto> Photos { get; set; } = new List<PiecePhoto>();
}
