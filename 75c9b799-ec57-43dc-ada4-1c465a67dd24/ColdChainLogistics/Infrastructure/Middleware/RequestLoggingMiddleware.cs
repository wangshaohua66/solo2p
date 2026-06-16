using Microsoft.AspNetCore.Http;
using Serilog;
using Serilog.Events;
using System.Diagnostics;

namespace ColdChainLogistics.Infrastructure.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public RequestLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var request = context.Request;
        var response = context.Response;

        Log.Information("API Request started: {Method} {Path} {QueryString}",
            request.Method,
            request.Path,
            request.QueryString);

        try
        {
            await _next(context);

            stopwatch.Stop();
            var logLevel = response.StatusCode >= 500 ? LogEventLevel.Error :
                           response.StatusCode >= 400 ? LogEventLevel.Warning :
                           LogEventLevel.Information;

            Log.Write(logLevel,
                "API Request completed: {Method} {Path} - StatusCode: {StatusCode} - Duration: {DurationMs}ms",
                request.Method,
                request.Path,
                response.StatusCode,
                stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            Log.Error(ex,
                "API Request failed: {Method} {Path} - Duration: {DurationMs}ms - Error: {Error}",
                request.Method,
                request.Path,
                stopwatch.ElapsedMilliseconds,
                ex.Message);
            throw;
        }
    }
}
