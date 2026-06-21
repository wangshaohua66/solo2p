using System.Globalization;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;

namespace UsedVehicleTransaction.Middleware;

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
        catch (BusinessException bex)
        {
            _logger.LogWarning(bex, "Business exception occurred: {Code} - {Message}", bex.Error.Code, bex.Error.MessageZh);
            await WriteResponseAsync(context, StatusCodes.Status400BadRequest, ApiResponse.Fail(bex.Error));
        }
        catch (FluentValidation.ValidationException vex)
        {
            var errors = vex.Errors.GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToList());
            var errorMessage = string.Join("; ", errors.SelectMany(kv => kv.Value));
            var errorMessageEn = "Validation failed: " + string.Join("; ", errors.SelectMany(kv => kv.Value));
            _logger.LogWarning(vex, "Validation failed: {Errors}", errorMessage);
            await WriteResponseAsync(context, StatusCodes.Status400BadRequest,
                ApiResponse.Fail(ErrorCodes.BadRequest.Code, errorMessage, errorMessageEn));
        }
        catch (OperationCanceledException ocex)
        {
            _logger.LogWarning(ocex, "Operation was canceled");
            await WriteResponseAsync(context, StatusCodes.Status408RequestTimeout,
                ApiResponse.Fail(50400, "操作超时", "Operation timed out"));
        }
        catch (Exception ex)
        {
            var traceId = ActivityContextTraceId(context);
            _logger.LogError(ex, "Unhandled exception occurred. TraceId: {TraceId}", traceId);
            await WriteResponseAsync(context, StatusCodes.Status500InternalServerError,
                ApiResponse.Fail(ErrorCodes.InternalServerError.Code,
                    $"{ErrorCodes.InternalServerError.MessageZh}（TraceId: {traceId}）",
                    $"{ErrorCodes.InternalServerError.MessageEn} (TraceId: {traceId})"));
        }
    }

    private static async Task WriteResponseAsync(HttpContext context, int statusCode, ApiResponse response)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        var json = System.Text.Json.JsonSerializer.Serialize(response, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
        await context.Response.WriteAsync(json);
    }

    private static string ActivityContextTraceId(HttpContext context)
    {
        return System.Diagnostics.Activity.Current?.Id ?? context.TraceIdentifier;
    }
}

public static class ExceptionHandlingMiddlewareExtensions
{
    public static IApplicationBuilder UseExceptionHandling(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ExceptionHandlingMiddleware>();
    }
}
