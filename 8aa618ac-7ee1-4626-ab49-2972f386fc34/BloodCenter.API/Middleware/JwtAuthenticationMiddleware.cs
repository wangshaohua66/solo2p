using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

namespace BloodCenter.API.Middleware;

public class JwtAuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;

    private static readonly string[] PublicPaths = new[]
    {
        "/api/auth/login",
        "/api/auth/refresh",
        "/swagger",
        "/swagger/index.html",
        "/swagger/v1/swagger.json",
        "/swagger.css",
        "/favicon.ico"
    };

    public JwtAuthenticationMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;

        if (IsPublicPath(path))
        {
            await _next(context);
            return;
        }

        var token = ExtractToken(context);
        if (string.IsNullOrEmpty(token))
        {
            context.Response.StatusCode = 401;
            await WriteUnauthorizedResponse(context, "Missing authentication token", context.TraceIdentifier);
            return;
        }

        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? "super_secret_key_for_blood_center_jwt_token_1234567890");
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _configuration["Jwt:Issuer"] ?? "BloodCenter",
                ValidateAudience = true,
                ValidAudience = _configuration["Jwt:Audience"] ?? "BloodCenterAPI",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
            context.User = principal;

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
            {
                context.Items["UserId"] = userId;
            }

            var role = principal.FindFirst(ClaimTypes.Role)?.Value;
            if (!string.IsNullOrEmpty(role))
            {
                context.Items["UserRole"] = role;
            }

            await _next(context);
        }
        catch (SecurityTokenExpiredException)
        {
            context.Response.StatusCode = 401;
            await WriteUnauthorizedResponse(context, "Token has expired", context.TraceIdentifier);
        }
        catch (SecurityTokenException)
        {
            context.Response.StatusCode = 401;
            await WriteUnauthorizedResponse(context, "Invalid token", context.TraceIdentifier);
        }
    }

    private static bool IsPublicPath(string path)
    {
        return PublicPaths.Any(p => path.StartsWith(p));
    }

    private static string? ExtractToken(HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return null;
        }
        return authHeader["Bearer ".Length..].Trim();
    }

    private static async Task WriteUnauthorizedResponse(HttpContext context, string message, string traceId)
    {
        context.Response.ContentType = "application/json";
        var response = System.Text.Json.JsonSerializer.Serialize(new
        {
            statusCode = 401,
            code = 8002,
            message,
            traceId,
            timestamp = DateTime.UtcNow
        });
        await context.Response.WriteAsync(response);
    }
}
