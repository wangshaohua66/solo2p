namespace MiningGovApi.Models;

public class ApiResponse
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ApiResponse<T> : ApiResponse
{
    public T? Data { get; set; }
}

public class PagedResult<T>
{
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public List<T> Items { get; set; } = [];
}

public class PagedQuery
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
