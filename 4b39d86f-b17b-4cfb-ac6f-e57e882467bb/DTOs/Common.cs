namespace HazChemSupervision.DTOs;

public class ApiResponse<T>
{
    public int Code { get; set; } = 200;
    public string Message { get; set; } = "success";
    public T? Data { get; set; }
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
}

public class ApiResponse : ApiResponse<object>
{
}

public class PagedRequest
{
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? SortField { get; set; }
    public string? SortOrder { get; set; } = "desc";
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new List<T>();
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPreviousPage => PageIndex > 1;
    public bool HasNextPage => PageIndex < TotalPages;
}

public class DateRangeFilter
{
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
    public UserInfoDto User { get; set; } = new UserInfoDto();
}

public class UserInfoDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int? EnterpriseId { get; set; }
    public string? EnterpriseName { get; set; }
    public string? Department { get; set; }
    public string? Position { get; set; }
}

public class IdNameDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
