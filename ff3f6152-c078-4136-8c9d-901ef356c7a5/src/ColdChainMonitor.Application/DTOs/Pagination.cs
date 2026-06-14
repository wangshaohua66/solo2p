namespace ColdChainMonitor.Application.DTOs;

public class CursorPagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public string? NextCursor { get; set; }
    public bool HasMore { get; set; }
    public int Limit { get; set; }
    public long TotalCount { get; set; }
}

public class CursorPagedQuery
{
    public string? Cursor { get; set; }
    public int Limit { get; set; } = 20;
    public string? SortBy { get; set; }
    public bool SortDesc { get; set; } = true;
}

public class DateRangeQuery
{
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
