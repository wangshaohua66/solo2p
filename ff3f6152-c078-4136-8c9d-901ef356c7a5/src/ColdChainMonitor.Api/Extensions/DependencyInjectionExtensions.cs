using Microsoft.Extensions.DependencyInjection;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Infrastructure.Data;
using ColdChainMonitor.Infrastructure.Repositories;
using ColdChainMonitor.Application.Services;

namespace ColdChainMonitor.Api.Extensions;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddColdChainServices(this IServiceCollection services)
    {
        services.AddScoped<MongoDbContext>();

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IDeviceRepository, DeviceRepository>();
        services.AddScoped<ITransportTaskRepository, TransportTaskRepository>();
        services.AddScoped<ITemperatureReadingRepository, TemperatureReadingRepository>();
        services.AddScoped<IAlertRepository, AlertRepository>();
        services.AddScoped<IAlertRuleRepository, AlertRuleRepository>();
        services.AddScoped<IQualityReportRepository, QualityReportRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();

        services.AddSingleton<AlertRuleEngine>();

        services.AddScoped<AuthService>();
        services.AddScoped<DeviceService>();
        services.AddScoped<TransportService>();
        services.AddScoped<AlertService>();
        services.AddScoped<MonitorService>();
        services.AddScoped<QualityService>();
        services.AddScoped<AuditService>();

        return services;
    }
}
