using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Middleware;
using SpecialEquipmentInspection.Repositories;
using SpecialEquipmentInspection.Services;
using SpecialEquipmentInspection.Validation;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    })
    .AddFluentValidation(fv => fv.RegisterValidatorsFromAssemblyContaining<CreateDeviceDtoValidator>());

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value is { Errors.Count: > 0 })
            .ToDictionary(
                e => e.Key,
                e => e.Value!.Errors.Select(er => string.IsNullOrEmpty(er.ErrorMessage) ? er.Exception?.Message ?? "无效值" : er.ErrorMessage).ToArray());

        var response = new ApiResponse
        {
            Code = 400,
            Message = "请求参数校验失败",
            Data = errors,
            TraceId = context.HttpContext.TraceIdentifier
        };
        return new BadRequestObjectResult(response);
    };
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "特种设备检验检测业务系统 API",
        Version = "v1",
        Description = "电梯、起重机械、压力容器、锅炉、客运索道、大型游乐设施六类特种设备定期检验与安全监察平台后端接口。"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT授权，请在下方输入：Bearer {token}",
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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.Configure<JwtOptions>(jwtSection);
builder.Services.Configure<InspectionOptions>(builder.Configuration.GetSection("Inspection"));
var jwtOptions = jwtSection.Get<JwtOptions>()!;

builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json; charset=utf-8";
                var traceId = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
                var payload = ApiResponse.Fail("未登录或令牌已失效，请重新登录", 401);
                payload.TraceId = traceId;
                return context.Response.WriteAsJsonAsync(payload);
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json; charset=utf-8";
                var traceId = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
                var payload = ApiResponse.Fail("权限不足，禁止访问", 403);
                payload.TraceId = traceId;
                return context.Response.WriteAsJsonAsync(payload);
            }
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();

builder.Services.AddScoped<IDeviceRepository, DeviceRepository>();
builder.Services.AddScoped<IInspectionRepository, InspectionRepository>();
builder.Services.AddScoped<IInspectorRepository, InspectorRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IInspectionService, InspectionService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddSingleton<IJwtService>(sp => new JwtService(sp.GetRequiredService<IOptions<JwtOptions>>().Value));
builder.Services.AddHostedService<AlertBackgroundService>();

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbInitializer.SeedAsync(db);
}

app.Run();
