using System.Net;
using System.Text.Json;
using BloodCenter.Core.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog.Context;

namespace BloodCenter.API.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = context.TraceIdentifier;

        using (LogContext.PushProperty("TraceId", traceId))
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception occurred. TraceId: {TraceId}", traceId);
                await HandleExceptionAsync(context, ex, traceId);
            }
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception, string traceId)
    {
        var (statusCode, errorCode, message) = exception switch
        {
            BloodCenterException bce => ((int)GetHttpStatusForErrorCode(bce.Code), (int)bce.Code, bce.Message),
            FluentValidation.ValidationException fve => ((int)HttpStatusCode.BadRequest, 1001, string.Join("; ", fve.Errors.Select(e => e.ErrorMessage))),
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, 1004, "Unauthorized access"),
            ArgumentException => ((int)HttpStatusCode.BadRequest, 1001, exception.Message),
            _ => ((int)HttpStatusCode.InternalServerError, 500, _env.IsDevelopment() ? exception.Message : "An internal server error occurred")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = new ErrorResponse(
            statusCode,
            errorCode,
            message,
            traceId,
            DateTime.UtcNow,
            exception is BloodCenterException bce2 && bce2 is DonorNotEligibleException dnee ? dnee.DeferralReasons : null
        );

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
    }

    private static HttpStatusCode GetHttpStatusForErrorCode(ErrorCode code)
    {
        return code switch
        {
            ErrorCode.NotFound => HttpStatusCode.NotFound,
            ErrorCode.ValidationError => HttpStatusCode.BadRequest,
            ErrorCode.AlreadyExists => HttpStatusCode.Conflict,
            ErrorCode.Unauthorized => HttpStatusCode.Unauthorized,
            ErrorCode.Forbidden => HttpStatusCode.Forbidden,
            ErrorCode.InvalidOperation => HttpStatusCode.BadRequest,
            ErrorCode.DonorNotEligible => HttpStatusCode.BadRequest,
            ErrorCode.DonorDeferred => HttpStatusCode.BadRequest,
            ErrorCode.InitialScreeningFailed => HttpStatusCode.BadRequest,
            ErrorCode.TestNotCompleted => HttpStatusCode.BadRequest,
            ErrorCode.TestPositive => HttpStatusCode.BadRequest,
            ErrorCode.ProductNotFound => HttpStatusCode.NotFound,
            ErrorCode.ProductExpired => HttpStatusCode.BadRequest,
            ErrorCode.InventoryInsufficient => HttpStatusCode.BadRequest,
            ErrorCode.ProductReserved => HttpStatusCode.Conflict,
            ErrorCode.CrossMatchIncompatible => HttpStatusCode.BadRequest,
            ErrorCode.RequestNotFound => HttpStatusCode.NotFound,
            ErrorCode.ScrapNotApproved => HttpStatusCode.BadRequest,
            ErrorCode.InvalidCredentials => HttpStatusCode.Unauthorized,
            ErrorCode.TokenExpired => HttpStatusCode.Unauthorized,
            ErrorCode.InvalidToken => HttpStatusCode.Unauthorized,
            ErrorCode.SecondaryTokenRequired => HttpStatusCode.Forbidden,
            _ => HttpStatusCode.InternalServerError
        };
    }
}

public record ErrorResponse(
    int StatusCode,
    int Code,
    string Message,
    string TraceId,
    DateTime Timestamp,
    IEnumerable<string>? Details
);
