namespace VenueManagementSystem.DTOs.Common;

/// <summary>
/// API 通用响应包装类
/// </summary>
/// <typeparam name="T">响应数据类型</typeparam>
public class ApiResponse<T>
{
    /// <summary>
    /// 响应状态码
    /// </summary>
    public int Code { get; set; }

    /// <summary>
    /// 响应消息
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// 响应数据
    /// </summary>
    public T? Data { get; set; }

    /// <summary>
    /// 请求是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 时间戳
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 创建成功响应
    /// </summary>
    public static ApiResponse<T> SuccessResult(T data, string message = "操作成功")
    {
        return new ApiResponse<T>
        {
            Code = StatusCodes.Status200OK,
            Message = message,
            Data = data,
            Success = true
        };
    }

    /// <summary>
    /// 创建失败响应
    /// </summary>
    public static ApiResponse<T> ErrorResult(string message, int code = StatusCodes.Status400BadRequest)
    {
        return new ApiResponse<T>
        {
            Code = code,
            Message = message,
            Data = default,
            Success = false
        };
    }
}

/// <summary>
/// API 通用响应包装类（无数据）
/// </summary>
public class ApiResponse
{
    /// <summary>
    /// 响应状态码
    /// </summary>
    public int Code { get; set; }

    /// <summary>
    /// 响应消息
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// 请求是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 时间戳
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 创建成功响应
    /// </summary>
    public static ApiResponse SuccessResult(string message = "操作成功")
    {
        return new ApiResponse
        {
            Code = StatusCodes.Status200OK,
            Message = message,
            Success = true
        };
    }

    /// <summary>
    /// 创建失败响应
    /// </summary>
    public static ApiResponse ErrorResult(string message, int code = StatusCodes.Status400BadRequest)
    {
        return new ApiResponse
        {
            Code = code,
            Message = message,
            Success = false
        };
    }
}

/// <summary>
/// 分页响应包装类
/// </summary>
/// <typeparam name="T">数据类型</typeparam>
public class PagedResponse<T> : ApiResponse<List<T>>
{
    /// <summary>
    /// 当前页码
    /// </summary>
    public int PageNumber { get; set; }

    /// <summary>
    /// 每页大小
    /// </summary>
    public int PageSize { get; set; }

    /// <summary>
    /// 总记录数
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// 总页数
    /// </summary>
    public int TotalPages { get; set; }

    /// <summary>
    /// 是否有上一页
    /// </summary>
    public bool HasPreviousPage => PageNumber > 1;

    /// <summary>
    /// 是否有下一页
    /// </summary>
    public bool HasNextPage => PageNumber < TotalPages;

    /// <summary>
    /// 创建分页响应
    /// </summary>
    public static PagedResponse<T> Create(List<T> data, int pageNumber, int pageSize, int totalCount)
    {
        return new PagedResponse<T>
        {
            Code = StatusCodes.Status200OK,
            Message = "查询成功",
            Data = data,
            Success = true,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }
}

/// <summary>
/// 分页查询参数
/// </summary>
public class PaginationQuery
{
    /// <summary>
    /// 页码（从1开始）
    /// </summary>
    public int PageNumber { get; set; } = 1;

    /// <summary>
    /// 每页大小
    /// </summary>
    public int PageSize { get; set; } = 10;

    /// <summary>
    /// 排序字段
    /// </summary>
    public string? SortBy { get; set; }

    /// <summary>
    /// 是否降序
    /// </summary>
    public bool IsDescending { get; set; } = false;
}
