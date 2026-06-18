using System.Text;
using HazChemSupervision.BackgroundServices;
using HazChemSupervision.Data;
using HazChemSupervision.DTOs;
using HazChemSupervision.Mapping;
using HazChemSupervision.Repositories;
using HazChemSupervision.Services;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
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

    c.MapType<LoginRequest>(() => new OpenApiSchema
    {
        Type = "object",
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["username"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("admin") },
            ["password"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("Admin@123") }
        }
    });

    c.MapType<InventoryTransactionCreateDto>(() => new OpenApiSchema
    {
        Type = "object",
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["inventoryId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["enterpriseId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["warehouseId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["chemicalId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["chemicalBatchId"] = new OpenApiSchema { Type = "integer", Nullable = true, Example = new OpenApiInteger(1) },
            ["transactionType"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1), Description = "1=原料入库,2=生产投入,3=成品入库,4=销售出库,5=退货入库,6=报废,7=调拨入,8=调拨出" },
            ["quantity"] = new OpenApiSchema { Type = "number", Format = "decimal", Example = new OpenApiDouble(500.5) },
            ["unit"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("kg") },
            ["remark"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("生产领料出库") },
            ["operatorId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["operatorName"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("张三") }
        }
    });

    c.MapType<CertificateVerifyDto>(() => new OpenApiSchema
    {
        Type = "object",
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["certificateNo"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("WH-HZ-2024-001234") },
            ["type"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1), Description = "1=安全生产许可证,2=经营许可证,3=运输许可证,4=操作人员资格证,5=培训合格证" },
            ["holderName"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("张三") },
            ["idCard"] = new OpenApiSchema { Type = "string", Nullable = true, Example = new OpenApiString("110101199001011234") }
        }
    });

    c.MapType<ChemicalBatchCreateDto>(() => new OpenApiSchema
    {
        Type = "object",
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["batchNo"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("BATCH-20240115-001") },
            ["enterpriseId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["chemicalId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["warehouseId"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["plannedQuantity"] = new OpenApiSchema { Type = "number", Format = "decimal", Example = new OpenApiDouble(1000.0) },
            ["unit"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("kg") },
            ["productionDate"] = new OpenApiSchema { Type = "string", Format = "date-time", Example = new OpenApiString("2024-01-15T08:00:00Z") },
            ["expiryDate"] = new OpenApiSchema { Type = "string", Format = "date-time", Example = new OpenApiString("2025-01-15T08:00:00Z") },
            ["remark"] = new OpenApiSchema { Type = "string", Example = new OpenApiString("01月批次生产") }
        }
    });

    c.MapType<AlertQueryDto>(() => new OpenApiSchema
    {
        Type = "object",
        Properties = new Dictionary<string, OpenApiSchema>
        {
            ["type"] = new OpenApiSchema { Type = "integer", Nullable = true, Example = new OpenApiInteger(1), Description = "预警类型" },
            ["level"] = new OpenApiSchema { Type = "integer", Nullable = true, Example = new OpenApiInteger(2), Description = "预警级别:1=信息,2=警告,3=危险,4=严重" },
            ["status"] = new OpenApiSchema { Type = "integer", Nullable = true, Example = new OpenApiInteger(1), Description = "状态:1=新建,2=已读,3=已处理,4=已关闭" },
            ["enterpriseId"] = new OpenApiSchema { Type = "integer", Nullable = true, Example = new OpenApiInteger(1) },
            ["isRead"] = new OpenApiSchema { Type = "boolean", Nullable = true, Example = new OpenApiBoolean(false) },
            ["isHandled"] = new OpenApiSchema { Type = "boolean", Nullable = true, Example = new OpenApiBoolean(false) },
            ["pageIndex"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(1) },
            ["pageSize"] = new OpenApiSchema { Type = "integer", Example = new OpenApiInteger(20) }
        }
    });

    c.SchemaFilter<SwaggerExampleFilter>();
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
builder.Services.AddScoped(typeof(OperatorIdNameResolver<>));

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

builder.Services.AddHttpClient();
builder.Services.AddHostedService<AlertCheckBackgroundService>();

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
