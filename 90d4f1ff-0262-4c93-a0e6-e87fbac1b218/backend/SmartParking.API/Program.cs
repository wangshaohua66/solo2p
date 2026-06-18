using Serilog;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Services;
using SmartParking.API.Services.Interfaces;
using SmartParking.API.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;
using Newtonsoft.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
{
    config
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console();
});

var services = builder.Services;
var config = builder.Configuration;

services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
        options.SerializerSettings.NullValueHandling = NullValueHandling.Ignore;
    });

services.AddEndpointsApiExplorer();

services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "智慧园区停车与充电管理 API",
        Version = "v1",
        Description = "ASP.NET Core 8 WebAPI - 产业园区智慧停车与充电管理系统",
        Contact = new OpenApiContact { Name = "Smart Parking Team" }
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) options.IncludeXmlComments(xmlPath);
});

services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = config.GetConnectionString("DefaultConnection");
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString), b =>
    {
        b.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
        b.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    });
});

services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = config.GetConnectionString("Redis");
    options.InstanceName = "SmartParking:";
});

var jwtSettings = config.GetSection("Jwt");
var key = Encoding.ASCII.GetBytes(jwtSettings["Secret"]!);

services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdmin", policy => policy.RequireRole("SuperAdmin"));
    options.AddPolicy("ParkOperator", policy => policy.RequireRole("SuperAdmin", "ParkOperator"));
    options.AddPolicy("ParkingAdmin", policy => policy.RequireRole("SuperAdmin", "ParkOperator", "ParkingAdmin"));
    options.AddPolicy("ChargingOps", policy => policy.RequireRole("SuperAdmin", "ParkOperator", "ChargingOps"));
});

services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetPreflightMaxAge(TimeSpan.FromDays(1));
    });
});

services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.MaximumReceiveMessageSize = 64 * 1024;
});

services.AddAutoMapper(Assembly.GetExecutingAssembly());

services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
services.AddFluentValidationAutoValidation();
services.AddFluentValidationClientsideAdapters();

services.AddScoped<IAuthService, AuthService>();
services.AddScoped<IParkingService, ParkingService>();
services.AddScoped<IChargingService, ChargingService>();
services.AddScoped<IBillingService, BillingService>();
services.AddScoped<IDashboardService, DashboardService>();
services.AddScoped<IPaymentService, PaymentService>();
services.AddScoped<IWorkOrderService, WorkOrderService>();
services.AddScoped<INotificationService, NotificationService>();
services.AddScoped<IRedisCacheService, RedisCacheService>();

services.AddHostedService<ReservationExpirationService>();
services.AddHostedService<HeartbeatMonitorService>();

services.AddHttpContextAccessor();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Parking API v1");
    c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
});

app.UseSerilogRequestLogging();

app.UseCors("AllowFrontend");

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseStaticFiles();

app.MapControllers();
app.MapHub<NotificationHub>("/hub/notification");

app.Run();
