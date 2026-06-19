using MiningGovApi.Models;

namespace MiningGovApi.Services;

public static class HttpContextExtensions
{
    public static User? GetCurrentUser(this HttpContext context)
    {
        return context.Items["User"] as User;
    }

    public static User RequireCurrentUser(this HttpContext context)
    {
        var user = context.GetCurrentUser();
        if (user == null)
        {
            throw new UnauthorizedAccessException("用户未登录或登录已过期");
        }
        return user;
    }
}
