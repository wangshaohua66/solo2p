using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace BloodCenter.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var traceId = context.TraceIdentifier;

        var method = context.Request.Method;
        var path = context.Request.Path;
        var queryString = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : string.Empty;

        _logger.LogInformation("Request started: {Method} {Path}{QueryString} TraceId: {TraceId}",
            method, path, queryString, traceId);

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            var statusCode = context.Response.StatusCode;
            var elapsedMs = stopwatch.ElapsedMilliseconds;

            if (statusCode >= 400)
            {
                _logger.LogWarning("Request completed: {Method} {Path} -> {StatusCode} in {ElapsedMs}ms TraceId: {TraceId}",
                    method, path, statusCode, elapsedMs, traceId);
            }
            else
            {
                _logger.LogInformation("Request completed: {Method} {Path} -> {StatusCode} in {ElapsedMs}ms TraceId: {TraceId}",
                    method, path, statusCode, elapsedMs, traceId);
            }

            if (elapsedMs > 200)
            {
                _logger.LogWarning("Slow request detected: {Method} {Path} took {ElapsedMs}ms TraceId: {TraceId}",
                    method, path, elapsedMs, traceId);
            }
        }
    }
}
