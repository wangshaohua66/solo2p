using Quartz;
using Serilog;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Infrastructure.Scheduling;

public class DeviceHealthCheckJob : IJob
{
    private readonly IDeviceHealthMonitorService _deviceHealthMonitorService;

    public DeviceHealthCheckJob(IDeviceHealthMonitorService deviceHealthMonitorService)
    {
        _deviceHealthMonitorService = deviceHealthMonitorService;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        Log.Information("Device health check job started");
        try
        {
            await _deviceHealthMonitorService.CheckDeviceHealthAsync();
            Log.Information("Device health check job completed");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Device health check job failed");
        }
    }
}

public class AlertEscalationJob : IJob
{
    private readonly INotificationService _notificationService;

    public AlertEscalationJob(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        Log.Information("Alert escalation job started");
        try
        {
            await _notificationService.ProcessEscalationAsync();
            Log.Information("Alert escalation job completed");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Alert escalation job failed");
        }
    }
}

public class MonthlyReportJob : IJob
{
    private readonly IReportService _reportService;

    public MonthlyReportJob(IReportService reportService)
    {
        _reportService = reportService;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        Log.Information("Monthly report generation job started");
        try
        {
            await _reportService.GenerateMonthlyReportsAsync();
            Log.Information("Monthly report generation job completed");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Monthly report generation job failed");
        }
    }
}

public class TableManagementJob : IJob
{
    private readonly ITableManagementService _tableManagementService;

    public TableManagementJob(ITableManagementService tableManagementService)
    {
        _tableManagementService = tableManagementService;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        Log.Information("Table management job started - creating next month tables");
        try
        {
            await _tableManagementService.CreateNextMonthTablesAsync();
            Log.Information("Table management job completed");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Table management job failed");
        }
    }
}

public static class QuartzConfiguration
{
    public static IServiceCollection AddQuartzJobs(this IServiceCollection services)
    {
        services.AddQuartz(q =>
        {
            q.UseMicrosoftDependencyInjectionJobFactory();

            var deviceHealthKey = new JobKey("DeviceHealthCheckJob");
            q.AddJob<DeviceHealthCheckJob>(opts => opts.WithIdentity(deviceHealthKey));
            q.AddTrigger(opts => opts
                .ForJob(deviceHealthKey)
                .WithIdentity("DeviceHealthCheckTrigger")
                .WithSimpleSchedule(x => x
                    .WithIntervalInMinutes(1)
                    .RepeatForever()));

            var alertEscalationKey = new JobKey("AlertEscalationJob");
            q.AddJob<AlertEscalationJob>(opts => opts.WithIdentity(alertEscalationKey));
            q.AddTrigger(opts => opts
                .ForJob(alertEscalationKey)
                .WithIdentity("AlertEscalationTrigger")
                .WithSimpleSchedule(x => x
                    .WithIntervalInMinutes(5)
                    .RepeatForever()));

            var monthlyReportKey = new JobKey("MonthlyReportJob");
            q.AddJob<MonthlyReportJob>(opts => opts.WithIdentity(monthlyReportKey));
            q.AddTrigger(opts => opts
                .ForJob(monthlyReportKey)
                .WithIdentity("MonthlyReportTrigger")
                .WithCronSchedule("0 0 2 1 * ?"));

            var tableMgmtKey = new JobKey("TableManagementJob");
            q.AddJob<TableManagementJob>(opts => opts.WithIdentity(tableMgmtKey));
            q.AddTrigger(opts => opts
                .ForJob(tableMgmtKey)
                .WithIdentity("TableManagementTrigger")
                .WithCronSchedule("0 0 3 28 * ?"));
        });

        services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

        return services;
    }
}
