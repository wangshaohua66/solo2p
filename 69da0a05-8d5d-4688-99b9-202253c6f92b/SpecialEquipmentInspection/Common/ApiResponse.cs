using System.Text.Json.Serialization;

namespace SpecialEquipmentInspection.Common;

public class ApiResponse
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Data { get; set; }

    [JsonPropertyName("traceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TraceId { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.Now;

    public static ApiResponse Ok(object? data = null, string message = "success")
        => new() { Code = 0, Message = message, Data = data };

    public static ApiResponse Fail(string message, int code = 500, object? data = null)
        => new() { Code = code, Message = message, Data = data };
}

public class ApiResponse<T> : ApiResponse
{
    public new T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "success")
        => new() { Code = 0, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message, int code = 500)
        => new() { Code = code, Message = message };
}
