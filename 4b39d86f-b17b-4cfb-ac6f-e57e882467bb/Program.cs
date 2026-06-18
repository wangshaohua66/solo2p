using System.Text;
using HazChemSupervision.Data;
using HazChemSupervision.Repositories;
using HazChemSupervision.Services;
using HazChemSupervision.Mapping;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
        options.SerializerSettings.NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore;
    })
    .AddFluentValidation(fv =>
    {
        fv.RegisterValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        fv.DisableDataAnnotationsValidation = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "危化品监管系统API",
        Version = "v1",
        Description = "省级应急管理厅危化品监管信息系统 - 支持批次全生命周期管理、库存动态监控、运输轨迹追踪、隐患闭环整改、应急演练管理、合规报告生成、资质证书校验",
        Contact = new OpenApiContact
        {
            Name = "危化品监管处",
            Email = "supervision@example.gov.cn"
        }
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "请输入JWT授权令牌: Bearer {token}",
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
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    c.EnableAnnotations();
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "HazChemSupervision_SecretKey_2024_VeryLongSecurityKeyForJWT";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HazChemSupervision";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HazChemSupervisionUsers";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("Supervisor", policy => policy.RequireRole("Admin", "Supervisor"));
    options.AddPolicy("EnterpriseUser", policy => policy.RequireRole("Admin", "Supervisor", "Enterprise"));
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var dbPath = builder.Configuration["ConnectionStrings:SQLite"] ?? "Data Source=HazChemSupervision.db";
    options.UseSqlite(dbPath, b => b.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors();
        options.EnableSensitiveDataLogging();
    }
});

builder.Services.AddAutoMapper(typeof(MappingProfile));

builder.Services.AddScoped(typeof(IBaseRepository<>), typeof(BaseRepository<>));
builder.Services.AddScoped<IComplianceService, ComplianceService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<ITransportService, TransportService>();
builder.Services.AddScoped<IChemicalBatchService, ChemicalBatchService>();
builder.Services.AddScoped<IHazardRectificationService, HazardRectificationService>();
builder.Services.AddScoped<IEmergencyDrillService, EmergencyDrillService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ICertificateService, CertificateService>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddMemoryCache();
builder.Services.AddResponseCaching();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
    await DbInitializer.Initialize(dbContext);
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "危化品监管系统API v1");
        c.DefaultModelsExpandDepth(-1);
        c.DisplayRequestDuration();
        c.EnableDeepLinking();
    });
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseResponseCaching();
app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<PerformanceMiddleware>();

app.MapControllers().RequireAuthorization();

app.Run();
