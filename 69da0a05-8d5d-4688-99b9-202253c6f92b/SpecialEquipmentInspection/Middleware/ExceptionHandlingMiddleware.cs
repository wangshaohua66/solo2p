using System.Net;
using System.Text.Json;
using SpecialEquipmentInspection.Common;

namespace SpecialEquipmentInspection.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;
        var response = new ApiResponse
        {
            TraceId = traceId
        };

        switch (exception)
        {
            case ValidationException ve:
                response.Code = ve.Code;
                response.Message = ve.Message;
                response.Data = ve.Errors;
                context.Response.StatusCode = ve.StatusCode;
                _logger.LogWarning("Validation failed. TraceId={TraceId} Errors={Errors}", traceId, ve.Errors);
                break;
            case AppException ae:
                response.Code = ae.Code;
                response.Message = ae.Message;
                context.Response.StatusCode = ae.StatusCode;
                _logger.LogWarning("App error. TraceId={TraceId} Code={Code} Message={Message}", traceId, ae.Code, ae.Message);
                break;
            default:
                response.Code = 500;
                response.Message = "服务器内部错误，请联系管理员";
                response.Data = new { detail = exception.Message };
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                _logger.LogError(exception, "Unhandled exception. TraceId={TraceId}", traceId);
                break;
        }

        context.Response.ContentType = "application/json; charset=utf-8";
        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        await context.Response.WriteAsync(json);
    }
}
