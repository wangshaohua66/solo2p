namespace FireIoTPlatform.Models.DTOs.Common;

public class ApiResponse<T>
{
    public int Code { get; set; } = 200;
    public string Message { get; set; } = "success";
    public T? Data { get; set; }
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public static ApiResponse<T> Success(T data)
    {
        return new ApiResponse<T> { Data = data };
    }

    public static ApiResponse<T> Success(string message, T data)
    {
        return new ApiResponse<T> { Message = message, Data = data };
    }

    public static ApiResponse<T> Error(int code, string message)
    {
        return new ApiResponse<T> { Code = code, Message = message };
    }
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse Success()
    {
        return new ApiResponse();
    }

    public new static ApiResponse Error(int code, string message)
    {
        return new ApiResponse { Code = code, Message = message };
    }
}
