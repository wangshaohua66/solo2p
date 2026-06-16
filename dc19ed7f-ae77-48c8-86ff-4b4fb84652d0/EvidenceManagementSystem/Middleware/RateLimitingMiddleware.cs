using System.Text.Json;
using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly SemaphoreSlim _semaphore;
    private const int MaxConcurrentRequests = 500;

    public RateLimitingMiddleware(
        RequestDelegate next,
        ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
        _semaphore = new SemaphoreSlim(MaxConcurrentRequests, MaxConcurrentRequests);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!await _semaphore.WaitAsync(0))
        {
            _logger.LogWarning("并发请求数超过上限 {MaxConcurrentRequests}，拒绝请求: {Path}",
                MaxConcurrentRequests, context.Request.Path);

            context.Response.StatusCode = 429;
            context.Response.Headers["Retry-After"] = "10";
            context.Response.ContentType = "application/json";

            var response = new ApiResponse
            {
                Code = 429,
                Message = "服务器繁忙，请稍后重试",
                Timestamp = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await context.Response.WriteAsync(json);
            return;
        }

        try
        {
            await _next(context);
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
