using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using FireIoTPlatform.Models.DTOs.Common;

namespace FireIoTPlatform.Filters;

public class GlobalExceptionFilter : IExceptionFilter
{
    private readonly ILogger<GlobalExceptionFilter> _logger;

    public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger)
    {
        _logger = logger;
    }

    public void OnException(ExceptionContext context)
    {
        _logger.LogError(context.Exception, "全局异常捕获: {Message}", context.Exception.Message);

        var result = new ObjectResult(ApiResponse.Error(500, context.Exception.Message))
        {
            StatusCode = StatusCodes.Status500InternalServerError
        };

        context.Result = result;
        context.ExceptionHandled = true;
    }
}
