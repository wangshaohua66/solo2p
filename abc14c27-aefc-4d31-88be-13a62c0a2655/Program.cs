using System.Globalization;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Serilog;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.Extensions;
using UsedVehicleTransaction.Middleware;
using UsedVehicleTransaction.Services;
using FluentValidation;
using FluentValidation.AspNetCore;

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json")
        .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", true)
        .Build())
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting Used Vehicle Transaction Service...");

    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    var services = builder.Services;
    var configuration = builder.Configuration;

    services.Configure<AppSettings>(configuration.GetSection("AppSettings"));
    services.Configure<ExternalApiSettings>(configuration.GetSection("ExternalApis"));

    services.AddDbContext<ApplicationDbContext>(options =>
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString), mySqlOptions =>
        {
            mySqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
            mySqlOptions.CommandTimeout(120);
            mySqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
        });
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    });

    services.AddMemoryCache();

    services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
            options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        });

    services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
    services.AddFluentValidationAutoValidation();
    services.AddFluentValidationClientsideAdapters();

    services.AddAutoMapper(Assembly.GetExecutingAssembly());

    services.AddScoped<IComplianceService, ComplianceService>();
    services.AddScoped<IInspectionService, InspectionService>();
    services.AddScoped<IArchiveService, ArchiveService>();
    services.AddScoped<IWorkflowService, WorkflowService>();
    services.AddScoped<IVehicleService, VehicleService>();
    services.AddScoped<ITransactionService, TransactionService>();
    services.AddScoped<IExceptionCaseService, ExceptionCaseService>();
    services.AddScoped<IStatisticsService, StatisticsService>();

    services.AddHttpClient("ExternalApi", client =>
    {
        client.DefaultRequestHeaders.Add("Accept", "application/json");
    });

    services.AddCustomSwagger();

    services.AddCors(options =>
    {
        options.AddPolicy("AllowAll", policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });

    var app = builder.Build();

    var supportedCultures = new[] { "zh-CN", "en-US" };
    app.UseRequestLocalization(new RequestLocalizationOptions()
        .SetDefaultCulture("zh-CN")
        .AddSupportedCultures(supportedCultures)
        .AddSupportedUICultures(supportedCultures));

    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        try
        {
            dbContext.Database.EnsureCreated();
            Log.Information("Database ensured created successfully.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An error occurred while creating the database.");
        }
    }

    if (app.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    else
    {
        app.UseHsts();
    }

    app.UseExceptionHandling();

    app.UseSerilogRequestLogging();

    app.UseHttpsRedirection();

    app.UseStaticFiles();

    app.UseRouting();

    app.UseCors("AllowAll");

    app.UseAuthorization();

    app.UseCustomSwagger();

    app.MapControllers();

    app.MapGet("/api/health", () => ApiResponse.Success(new
    {
        Status = "Healthy",
        Time = DateTimeOffset.Now.ToString("o"),
        Version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0"
    }, "服务运行正常", "Service is running healthy"))
    .WithName("HealthCheck")
    .WithOpenApi();

    app.Run();

    Log.Information("Used Vehicle Transaction Service started successfully.");
}
catch (Exception ex)
{
    Log.Fatal(ex, "Used Vehicle Transaction Service terminated unexpectedly.");
}
finally
{
    Log.CloseAndFlush();
}
