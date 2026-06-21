namespace UsedVehicleTransaction.Common;

public class ApiResponse
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
    public string MessageEn { get; set; } = string.Empty;
    public object? Data { get; set; }
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public static ApiResponse Success(object? data = null, string message = "操作成功", string messageEn = "Operation succeeded")
    {
        return new ApiResponse
        {
            Code = 0,
            Message = message,
            MessageEn = messageEn,
            Data = data
        };
    }

    public static ApiResponse Success<T>(T data, string message = "操作成功", string messageEn = "Operation succeeded")
    {
        return new ApiResponse
        {
            Code = 0,
            Message = message,
            MessageEn = messageEn,
            Data = data
        };
    }

    public static ApiResponse Fail(int code, string message, string messageEn)
    {
        return new ApiResponse
        {
            Code = code,
            Message = message,
            MessageEn = messageEn,
            Data = null
        };
    }

    public static ApiResponse Fail(ErrorInfo error)
    {
        return new ApiResponse
        {
            Code = error.Code,
            Message = error.MessageZh,
            MessageEn = error.MessageEn,
            Data = null
        };
    }
}

public class ApiResponse<T>
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
    public string MessageEn { get; set; } = string.Empty;
    public T? Data { get; set; }
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public static ApiResponse<T> Success(T data, string message = "操作成功", string messageEn = "Operation succeeded")
    {
        return new ApiResponse<T>
        {
            Code = 0,
            Message = message,
            MessageEn = messageEn,
            Data = data
        };
    }

    public static ApiResponse<T> Fail(int code, string message, string messageEn)
    {
        return new ApiResponse<T>
        {
            Code = code,
            Message = message,
            MessageEn = messageEn,
            Data = default
        };
    }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPreviousPage => PageIndex > 1;
    public bool HasNextPage => PageIndex < TotalPages;
}
