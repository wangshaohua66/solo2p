namespace PotteryStudio;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int AccessTokenExpirationMinutes { get; set; } = 120;
    public int RefreshTokenExpirationDays { get; set; } = 7;
}

public class AppSettings
{
    public string UploadPath { get; set; } = "Uploads";
    public int MaxFileSizeMB { get; set; } = 8;
    public int ThumbnailWidth { get; set; } = 400;
    public int DefaultPageSize { get; set; } = 20;
    public int MaxPageSize { get; set; } = 100;
    public int MembershipExpiryWarningDays { get; set; } = 14;
    public int DailyCleanupHour { get; set; } = 3;
    public int LogRetentionDays { get; set; } = 30;
    public int MaxConcurrentAdmins { get; set; } = 10;
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class PagedQuery
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public string? SortOrder { get; set; } = "desc";
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "操作成功")
    {
        return new ApiResponse<T>
        {
            Success = true,
            Code = 200,
            Message = message,
            Data = data
        };
    }

    public static ApiResponse<T> Error(string message, int code = 400)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Code = code,
            Message = message
        };
    }
}

public static class PagedResult
{
    public static PagedResult<T> Create<T>(IEnumerable<T> items, int totalCount, int pageIndex, int pageSize)
    {
        return new PagedResult<T>
        {
            Items = items.ToList(),
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        };
    }
}
