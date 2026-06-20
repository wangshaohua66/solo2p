using Serilog;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Services;
using FireIoTPlatform.Hubs;
using FireIoTPlatform.Filters;
using FireIoTPlatform.BackgroundServices;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/fireiot-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers(options =>
{
    options.Filters.Add<GlobalExceptionFilter>();
}).AddNewtonsoftJson(options =>
{
    options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
    options.SerializerSettings.DateTimeZoneHandling = Newtonsoft.Json.DateTimeZoneHandling.Local;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "消防物联网监测与应急调度平台 API",
        Version = "v1",
        Description = "某市消防救援支队消防物联网监测与应急调度平台接口文档"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var mysqlConnectionString = builder.Configuration.GetConnectionString("MySqlConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(mysqlConnectionString, ServerVersion.AutoDetect(mysqlConnectionString),
        mysqlOptions =>
        {
            mysqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
        }));

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = ConfigurationOptions.Parse(builder.Configuration.GetConnectionString("RedisConnection") ?? "localhost:6379");
    configuration.ResolveDns = true;
    configuration.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(configuration);
});

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = bool.TryParse(builder.Configuration["SignalRSettings:EnableDetailedErrors"], out var e) && e;
    options.KeepAliveInterval = TimeSpan.FromSeconds(int.TryParse(builder.Configuration["SignalRSettings:KeepAliveIntervalSeconds"], out var k) ? k : 15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(int.TryParse(builder.Configuration["SignalRSettings:ClientTimeoutIntervalSeconds"], out var t) ? t : 30);
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"] ?? "FireIoTPlatform2024SuperSecretKeyForJwtTokenAuthentication")),
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("Content-Disposition");
    });
});

builder.Services.AddHttpClient();

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IRedisCacheService, RedisCacheService>();
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddScoped<IAlarmService, AlarmService>();
builder.Services.AddScoped<IInspectionService, InspectionService>();
builder.Services.AddScoped<IDispatchService, DispatchService>();
builder.Services.AddScoped<IFireUnitService, FireUnitService>();
builder.Services.AddScoped<IMaintenanceService, MaintenanceService>();
builder.Services.AddScoped<IStatisticsService, StatisticsService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IThirdPartyIntegrationService, ThirdPartyIntegrationService>();
builder.Services.AddScoped<IWorkOrderService, WorkOrderService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IDeviceDataShardingService, DeviceDataShardingService>();

builder.Services.AddHostedService<DeviceHeartbeatMonitorService>();
builder.Services.AddHostedService<AlarmAggregationService>();
builder.Services.AddHostedService<ScheduledTaskService>();
builder.Services.AddHostedService<MqttMessageHandlerService>();

builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "消防物联网监测与应急调度平台 API v1");
    });
}

app.UseSerilogRequestLogging();

app.UseCors("AllowAll");

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<FireAlarmHub>("/hubs/fireAlarm");

app.MapGet("/", () => new
{
    Name = "消防物联网监测与应急调度平台",
    Version = "v1.0.0",
    Status = "Running",
    Time = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
});

try
{
    Log.Information("应用启动中...");

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (db.Database.CanConnect())
        {
            Log.Information("数据库连接成功");
        }
        else
        {
            Log.Warning("数据库连接失败，请检查配置");
        }

        try
        {
            var shardingService = scope.ServiceProvider.GetRequiredService<IDeviceDataShardingService>();
            var now = DateTime.Now;
            await shardingService.EnsureTableExistsAsync(now);
            await shardingService.EnsureTableExistsAsync(now.AddMonths(1));
            Log.Information("设备数据分表初始化完成");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "设备数据分表初始化失败");
        }
    }

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "应用启动失败");
}
finally
{
    Log.CloseAndFlush();
}
