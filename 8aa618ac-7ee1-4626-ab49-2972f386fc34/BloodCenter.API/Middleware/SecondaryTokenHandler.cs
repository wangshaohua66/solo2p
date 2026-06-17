using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace BloodCenter.API.Middleware;

public class SecondaryTokenRequirement : IAuthorizationRequirement
{
}

public class SecondaryTokenHandler : AuthorizationHandler<SecondaryTokenRequirement>
{
    private readonly IServiceProvider _serviceProvider;

    public SecondaryTokenHandler(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, SecondaryTokenRequirement requirement)
    {
        var httpContext = context.Resource as HttpContext;
        if (httpContext == null)
        {
            return;
        }

        var secondaryToken = httpContext.Request.Headers["X-Secondary-Token"].FirstOrDefault();
        if (string.IsNullOrEmpty(secondaryToken))
        {
            return;
        }

        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
        {
            return;
        }

        using var scope = _serviceProvider.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<BloodCenter.Core.Interfaces.IAuthService>();

        if (await authService.ValidateSecondaryTokenAsync(userGuid, secondaryToken))
        {
            context.Succeed(requirement);
        }
    }
}

public static class AuthorizationPolicySetup
{
    public static void AddSecondaryTokenPolicy(this IServiceCollection services)
    {
        services.AddScoped<IAuthorizationHandler, SecondaryTokenHandler>();
        services.AddAuthorization(options =>
        {
            options.AddPolicy("Administrator", policy =>
                policy.RequireRole("Administrator"));

            options.AddPolicy("Nurse", policy =>
                policy.RequireRole("Administrator", "Nurse"));

            options.AddPolicy("Technician", policy =>
                policy.RequireRole("Administrator", "Technician"));

            options.AddPolicy("HospitalInterface", policy =>
                policy.RequireRole("Administrator", "HospitalInterface"));

            options.AddPolicy("SecondaryAuth", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.Requirements.Add(new SecondaryTokenRequirement());
            });

            options.AddPolicy("AdminWithSecondaryAuth", policy =>
            {
                policy.RequireRole("Administrator");
                policy.Requirements.Add(new SecondaryTokenRequirement());
            });
        });
    }
}
