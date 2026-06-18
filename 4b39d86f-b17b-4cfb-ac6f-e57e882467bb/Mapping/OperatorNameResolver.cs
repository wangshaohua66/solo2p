using AutoMapper;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;

namespace HazChemSupervision.Mapping;

public class OperatorNameResolver : IValueResolver<object, object, string?>
{
    private readonly IBaseRepository<User> _userRepo;

    public OperatorNameResolver(IBaseRepository<User> userRepo)
    {
        _userRepo = userRepo;
    }

    public string? Resolve(object source, object destination, string? destMember, ResolutionContext context)
    {
        if (context.Items.TryGetValue("OperatorId", out var idObj) && idObj is int id && id > 0)
        {
            return GetUserName(id);
        }
        return null;
    }

    private string? GetUserName(int userId)
    {
        var user = _userRepo.GetByIdAsync(userId).GetAwaiter().GetResult();
        return user != null ? user.RealName : null;
    }
}

public class OperatorIdNameResolver<TSource> : IMemberValueResolver<TSource, object, int?, string?>
    where TSource : class
{
    private readonly IBaseRepository<User> _userRepo;
    private static readonly Dictionary<int, string> _cache = new();
    private static readonly object _cacheLock = new();

    public OperatorIdNameResolver(IBaseRepository<User> userRepo)
    {
        _userRepo = userRepo;
    }

    public string? Resolve(TSource source, object destination, int? sourceMember, string? destMember, ResolutionContext context)
    {
        if (!sourceMember.HasValue || sourceMember.Value <= 0)
            return null;

        var id = sourceMember.Value;
        lock (_cacheLock)
        {
            if (_cache.TryGetValue(id, out var cachedName))
                return cachedName;
        }

        var user = _userRepo.GetByIdAsync(id).GetAwaiter().GetResult();
        var name = user != null ? user.RealName : $"用户_{id}";

        lock (_cacheLock)
        {
            _cache[id] = name;
            if (_cache.Count > 1000)
                _cache.Clear();
        }

        return name;
    }
}
