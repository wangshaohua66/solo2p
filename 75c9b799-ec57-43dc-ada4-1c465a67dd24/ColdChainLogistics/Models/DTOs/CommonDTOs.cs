namespace ColdChainLogistics.Models.DTOs;

public class ApiResponse<T>
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public bool Success => Code == 0;
}

public class ApiResponse
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool Success => Code == 0;
}

public class ValidationErrorResponse
{
    public int Code { get; set; } = 400;
    public string Message { get; set; } = "参数校验失败";
    public List<ValidationErrorItem> Errors { get; set; } = new();
}

public class ValidationErrorItem
{
    public string Field { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}

public class PagedRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PagedResult<T>
{
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public List<T> Items { get; set; } = new();
}
