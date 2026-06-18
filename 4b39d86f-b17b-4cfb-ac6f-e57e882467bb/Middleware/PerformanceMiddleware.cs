using System.Diagnostics;

namespace HazChemSupervision.Middleware;

public class PerformanceMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PerformanceMiddleware> _logger;

    public PerformanceMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<PerformanceMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var warningThreshold = int.Parse(_configuration["Performance:WarningThresholdMs"] ?? "200");
        var errorThreshold = int.Parse(_configuration["Performance:ErrorThresholdMs"] ?? "500");

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            var elapsedMs = stopwatch.ElapsedMilliseconds;

            context.Response.Headers["X-Response-Time"] = elapsedMs.ToString();

            if (elapsedMs > errorThreshold)
            {
                _logger.LogError(
                    "API请求超时 [{Method}] {Path} - 耗时: {ElapsedMs}ms, 阈值: {ErrorThreshold}ms",
                    context.Request.Method,
                    context.Request.Path,
                    elapsedMs,
                    errorThreshold);
            }
            else if (elapsedMs > warningThreshold)
            {
                _logger.LogWarning(
                    "API请求性能警告 [{Method}] {Path} - 耗时: {ElapsedMs}ms, 阈值: {WarningThreshold}ms",
                    context.Request.Method,
                    context.Request.Path,
                    elapsedMs,
                    warningThreshold);
            }
            else
            {
                _logger.LogDebug(
                    "API请求 [{Method}] {Path} - 耗时: {ElapsedMs}ms",
                    context.Request.Method,
                    context.Request.Path,
                    elapsedMs);
            }
        }
    }
}
