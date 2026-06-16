using System.Reflection;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using FluentValidation.AspNetCore;
using Serilog;
using ColdChainLogistics.Data;
using ColdChainLogistics.Infrastructure.Logging;
using ColdChainLogistics.Infrastructure.Middleware;
using ColdChainLogistics.Infrastructure.Validation;
using ColdChainLogistics.Infrastructure.Scheduling;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Repositories.Implementations;
using ColdChainLogistics.Services.Interfaces;
using ColdChainLogistics.Services.Implementations;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseColdChainSerilog();

builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFailedFilter>();
})
.AddNewtonsoftJson(options =>
{
    options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
    options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "药品冷链物流监管平台 API",
        Version = "v1",
        Description = "基于 ASP.NET Core 8.0 的药品冷链物流温湿度监控与溯源系统，" +
                      "提供传感器数据采集、实时异常检测、可编程规则引擎、全链路溯源和GSP合规报告等功能。",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "冷链物流技术团队"
        }
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath, true);
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString), mysqlOptions =>
    {
        mysqlOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
        mysqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorNumbersToAdd: null);
    });
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});

builder.Services.AddScoped<ITableManagementService, TableManagementService>();

builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped(typeof(IPagedRepository<>), typeof(PagedRepository<>));
builder.Services.AddScoped<ISensorRepository, SensorRepository>();
builder.Services.AddScoped<IVehicleRepository, VehicleRepository>();
builder.Services.AddScoped<IWarehouseRepository, WarehouseRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<IShipmentRepository, ShipmentRepository>();
builder.Services.AddScoped<IShipmentBatchRepository, ShipmentBatchRepository>();
builder.Services.AddScoped<ISensorDataRepository, SensorDataRepository>();
builder.Services.AddScoped<IAlertRuleRepository, AlertRuleRepository>();
builder.Services.AddScoped<IAlertRepository, AlertRepository>();
builder.Services.AddScoped<INotificationRecordRepository, NotificationRecordRepository>();
builder.Services.AddScoped<ITraceabilityRepository, TraceabilityRepository>();
builder.Services.AddScoped<IReportRecordRepository, ReportRecordRepository>();
builder.Services.AddScoped<IDeviceMaintenanceWindowRepository, DeviceMaintenanceWindowRepository>();
builder.Services.AddScoped<INotificationPreferenceRepository, NotificationPreferenceRepository>();
builder.Services.AddScoped<IAlertRuleAuditLogRepository, AlertRuleAuditLogRepository>();

builder.Services.AddScoped<ISensorDataService, SensorDataService>();
builder.Services.AddScoped<IAlertRuleEngineService, AlertRuleEngineService>();
builder.Services.AddScoped<ITraceabilityService, TraceabilityService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IDeviceHealthMonitorService, DeviceHealthMonitorService>();
builder.Services.AddScoped<IShipmentService, ShipmentService>();
builder.Services.AddScoped<IAlertRuleService, AlertRuleService>();
builder.Services.AddScoped<IAlertService, AlertService>();

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddFluentValidationClientsideAdapters();
builder.Services.AddValidatorsFromAssemblyContaining<SensorDataBatchRequestValidator>();

builder.Services.AddQuartzJobs();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "药品冷链物流监管平台 API v1");
    c.RoutePrefix = string.Empty;
});

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseRouting();
app.UseAuthorization();

app.MapControllers();

try
{
    Log.Information("应用程序启动中...");

    using (var scope = app.Services.CreateScope())
    {
        var services = scope.ServiceProvider;
        try
        {
            var context = services.GetRequiredService<AppDbContext>();
            var tableManagement = services.GetRequiredService<ITableManagementService>();

            Log.Information("初始化数据库和月度分表...");
            await tableManagement.EnsureCurrentMonthTablesExistAsync();
            await tableManagement.CreateNextMonthTablesAsync();
            Log.Information("数据库初始化完成");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "数据库初始化失败");
        }
    }

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "应用程序启动失败");
}
finally
{
    Log.CloseAndFlush();
}
