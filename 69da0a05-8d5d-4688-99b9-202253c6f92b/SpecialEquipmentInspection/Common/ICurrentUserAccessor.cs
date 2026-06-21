namespace SpecialEquipmentInspection.Common;

public interface ICurrentUserAccessor
{
    CurrentUser User { get; }
    string? TraceId { get; }
}

public class CurrentUserAccessor : ICurrentUserAccessor
{
    private readonly IHttpContextAccessor _accessor;
    public CurrentUserAccessor(IHttpContextAccessor accessor) => _accessor = accessor;

    public CurrentUser User => CurrentUser.FromClaimsPrincipal(_accessor.HttpContext?.User);

    public string? TraceId => _accessor.HttpContext?.TraceIdentifier;
}
