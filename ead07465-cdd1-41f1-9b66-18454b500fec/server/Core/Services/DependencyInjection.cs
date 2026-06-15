using Microsoft.Extensions.DependencyInjection;

namespace WaterDispatch.Core.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddCoreServices(this IServiceCollection services)
    {
        services.AddScoped<ILeakDetectService, LeakDetectService>();
        services.AddScoped<IOutagePredictService, OutagePredictService>();
        services.AddScoped<IRepairDispatchService, RepairDispatchService>();
        return services;
    }
}
