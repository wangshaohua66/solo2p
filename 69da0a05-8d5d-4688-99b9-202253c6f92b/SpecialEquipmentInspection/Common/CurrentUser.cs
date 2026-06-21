using System.Security.Claims;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Common;

public class CurrentUser
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string UseUnitCode { get; set; } = string.Empty;
    public int? InspectorId { get; set; }
    public bool IsAuthenticated { get; set; }

    public bool IsAdmin => Role == UserRole.Admin;
    public bool IsInspector => Role == UserRole.Inspector;
    public bool IsUserUnit => Role == UserRole.UserUnit;

    public static CurrentUser FromClaimsPrincipal(ClaimsPrincipal? principal)
    {
        var user = new CurrentUser();
        if (principal?.Identity?.IsAuthenticated != true)
        {
            return user;
        }

        user.IsAuthenticated = true;
        user.UserId = GetInt(principal, ClaimTypes.NameIdentifier);
        user.Username = principal.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;
        user.RealName = principal.FindFirst("real_name")?.Value ?? string.Empty;
        user.UseUnitCode = principal.FindFirst("use_unit_code")?.Value ?? string.Empty;
        var inspectorIdStr = principal.FindFirst("inspector_id")?.Value;
        if (int.TryParse(inspectorIdStr, out var iid)) user.InspectorId = iid;

        var roleStr = principal.FindFirst(ClaimTypes.Role)?.Value;
        if (Enum.TryParse<UserRole>(roleStr, out var role)) user.Role = role;

        return user;
    }

    private static int GetInt(ClaimsPrincipal p, string type)
    {
        var v = p.FindFirst(type)?.Value;
        return int.TryParse(v, out var i) ? i : 0;
    }
}
