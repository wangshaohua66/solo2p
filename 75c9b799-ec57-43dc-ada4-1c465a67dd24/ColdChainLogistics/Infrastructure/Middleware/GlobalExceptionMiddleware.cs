using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Serilog;
using ColdChainLogistics.Models.DTOs;

namespace ColdChainLogistics.Infrastructure.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public GlobalExceptionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var response = new ApiResponse
        {
            Code = 500,
            Message = "服务器内部错误，请稍后重试"
        };

        return context.Response.WriteAsJsonAsync(response);
    }
}

public class ValidationFailedFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var errors = context.ModelState
                .Where(kvp => kvp.Value != null && kvp.Value.Errors.Count > 0)
                .SelectMany(kvp => kvp.Value!.Errors.Select(e => new ValidationErrorItem
                {
                    Field = kvp.Key,
                    ErrorCode = "VALIDATION_ERROR",
                    ErrorMessage = e.ErrorMessage
                }))
                .ToList();

            var response = new ValidationErrorResponse
            {
                Code = 400,
                Message = "参数校验失败",
                Errors = errors
            };

            context.Result = new BadRequestObjectResult(response);
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}
