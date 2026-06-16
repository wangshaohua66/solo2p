using System.Text.Json;
using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Middleware;

public class JwtMiddleware
{
    private readonly RequestDelegate _next;

    public JwtMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value;
        if (path != null && (path.StartsWith("/api/auth") || path.StartsWith("/swagger") || path == "/"))
        {
            await _next(context);
            return;
        }

        var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Split(" ").Last();
        if (string.IsNullOrEmpty(token))
        {
            await WriteUnauthorizedResponse(context, "缺少认证令牌");
            return;
        }

        try
        {
            await _next(context);
        }
        catch
        {
            await WriteUnauthorizedResponse(context, "认证令牌无效或已过期");
        }
    }

    private static async Task WriteUnauthorizedResponse(HttpContext context, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = 401;

        var response = new ApiResponse
        {
            Code = 401,
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
