namespace WaterManagement.API.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public long? Total { get; set; }
    public Dictionary<string, string>? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, long? total = null)
    {
        return new ApiResponse<T> { Success = true, Code = "SUCCESS", Data = data, Total = total };
    }

    public static ApiResponse<T> Fail(string code, string message, Dictionary<string, string>? errors = null)
    {
        return new ApiResponse<T> { Success = false, Code = code, Message = message, Errors = errors };
    }
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse Ok()
    {
        return new ApiResponse { Success = true, Code = "SUCCESS" };
    }

    public new static ApiResponse Fail(string code, string message, Dictionary<string, string>? errors = null)
    {
        return new ApiResponse { Success = false, Code = code, Message = message, Errors = errors };
    }
}

public class PagedQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public bool SortDesc { get; set; } = true;
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public long Total { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}
