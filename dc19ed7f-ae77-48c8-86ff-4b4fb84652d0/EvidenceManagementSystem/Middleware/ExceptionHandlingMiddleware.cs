using System.Text.Json;
using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Middleware;

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
        catch (BusinessException ex)
        {
            _logger.LogWarning(ex, "业务异常: {Message}", ex.Message);
            await WriteErrorResponseAsync(context, ex.Code, ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "未授权访问");
            await WriteErrorResponseAsync(context, 401, "未授权访问");
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "参数错误: {Message}", ex.Message);
            await WriteErrorResponseAsync(context, 422, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "服务器内部错误");
            await WriteErrorResponseAsync(context, 500, "服务器内部错误");
        }
    }

    private static async Task WriteErrorResponseAsync(HttpContext context, int statusCode, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = new ApiResponse
        {
            Code = statusCode,
            Message = message,
            Timestamp = DateTime.UtcNow
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
