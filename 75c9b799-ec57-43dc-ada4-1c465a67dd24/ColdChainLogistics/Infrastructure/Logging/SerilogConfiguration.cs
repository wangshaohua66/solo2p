using Serilog;
using Serilog.Events;

namespace ColdChainLogistics.Infrastructure.Logging;

public static class SerilogConfiguration
{
    public static IHostBuilder UseColdChainSerilog(this IHostBuilder builder)
    {
        builder.UseSerilog((context, services, configuration) =>
        {
            configuration
                .ReadFrom.Configuration(context.Configuration)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", "ColdChainLogistics")
                .Enrich.WithProperty("Environment", context.HostingEnvironment.EnvironmentName)
                .Filter.ByExcluding(c => c.MessageTemplate.Text.Contains("health"))
                .WriteTo.Console(
                    outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
                .WriteTo.File(
                    path: "logs/coldchain-.log",
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 90,
                    fileSizeLimitBytes: 50 * 1024 * 1024,
                    rollOnFileSizeLimit: true,
                    outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}",
                    restrictedToMinimumLevel: LogEventLevel.Information)
                .WriteTo.File(
                    path: "logs/error-.log",
                    rollingInterval: RollingInterval.Day,
                    retainedFileCountLimit: 90,
                    fileSizeLimitBytes: 50 * 1024 * 1024,
                    rollOnFileSizeLimit: true,
                    outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}",
                    restrictedToMinimumLevel: LogEventLevel.Error);
        });

        return builder;
    }
}
