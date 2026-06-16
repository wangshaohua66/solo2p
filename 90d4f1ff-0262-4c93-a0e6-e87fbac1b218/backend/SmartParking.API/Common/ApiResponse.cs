namespace SmartParking.API.Common;

public class ApiResponse
{
    public int Code { get; set; } = 200;
    public string Message { get; set; } = "Success";
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    public static ApiResponse Ok(string message = "Success") =>
        new() { Code = 200, Message = message };

    public static ApiResponse Error(string message, int code = 500) =>
        new() { Code = code, Message = message };
}

public class ApiResponse<T> : ApiResponse
{
    public T? Data { get; set; }

    public static ApiResponse<T> Success(T data, string message = "Success") =>
        new() { Code = 200, Message = message, Data = data };

    public new static ApiResponse<T> Error(string message, int code = 500) =>
        new() { Code = code, Message = message, Data = default };
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / Math.Max(1, PageSize));

    public static PagedResult<T> Create(IEnumerable<T> items, int totalCount, int pageIndex, int pageSize) =>
        new() { Items = items.ToList(), TotalCount = totalCount, PageIndex = pageIndex, PageSize = pageSize };
}

public class PagedQuery
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public SortDirection SortDirection { get; set; } = SortDirection.Descending;
}
