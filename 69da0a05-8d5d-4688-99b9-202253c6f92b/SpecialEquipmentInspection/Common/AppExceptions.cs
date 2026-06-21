namespace SpecialEquipmentInspection.Common;

public class AppException : Exception
{
    public int StatusCode { get; }
    public int Code { get; }

    public AppException(string message, int statusCode = 400, int code = 400) : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message, 404, 404) { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "无权限执行该操作") : base(message, 403, 403) { }
}

public class BusinessException : AppException
{
    public BusinessException(string message, int code = 422) : base(message, 400, code) { }
}

public class ValidationException : AppException
{
    public IDictionary<string, string[]> Errors { get; }

    public ValidationException(IDictionary<string, string[]> errors)
        : base("请求参数校验失败", 400, 400)
    {
        Errors = errors;
    }
}
