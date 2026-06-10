namespace PotteryStudio.Models;

public enum NotificationType
{
    System,
    Membership,
    Course,
    Kiln,
    Inventory
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public NotificationType Type { get; set; } = NotificationType.System;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Link { get; set; }
    public string? Data { get; set; }
}

public class UploadResult
{
    public Guid Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long Size { get; set; }
    public string MimeType { get; set; } = string.Empty;
    public string Category { get; set; } = "general";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class ChunkUploadInfo
{
    public string UploadId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public int TotalChunks { get; set; }
    public HashSet<int> ReceivedChunks { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
