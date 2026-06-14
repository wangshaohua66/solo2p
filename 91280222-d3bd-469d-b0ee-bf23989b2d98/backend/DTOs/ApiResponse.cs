namespace BlueprintReview.DTOs;

public class ApiResponse<T>
{
    public int Code { get; set; } = 200;
    public string Message { get; set; } = "success";
    public T? Data { get; set; }

    public static ApiResponse<T> Success(T data, string message = "success")
    {
        return new ApiResponse<T> { Code = 200, Message = message, Data = data };
    }

    public static ApiResponse<T> Error(string message, int code = 500)
    {
        return new ApiResponse<T> { Code = code, Message = message, Data = default };
    }
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse Success(string message = "success")
    {
        return new ApiResponse { Code = 200, Message = message };
    }

    public new static ApiResponse Error(string message, int code = 500)
    {
        return new ApiResponse { Code = code, Message = message };
    }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
