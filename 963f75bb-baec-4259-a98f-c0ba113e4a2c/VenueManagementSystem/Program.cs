using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Newtonsoft.Json;
using StackExchange.Redis;
using Swashbuckle.AspNetCore.Filters;
using System.ComponentModel;
using System.Reflection;
using System.Text;
using VenueManagementSystem.Data;
using VenueManagementSystem.Services;
using VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 场馆管理系统 Web 应用程序入口点
/// 配置并启动 ASP.NET Core 8.0 Web 应用，包含完整的服务注册和中间件管道配置
/// </summary>
var builder = WebApplication.CreateBuilder(args);

#region 控制器配置
/// <summary>
/// 添加 MVC 控制器服务并配置 Newtonsoft.Json 序列化选项
/// - 配置循环引用处理（忽略循环引用）
/// - 配置空值处理（忽略空值）
/// - 配置日期时间格式（ISO 8601）
/// </summary>
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
        options.SerializerSettings.NullValueHandling = NullValueHandling.Ignore;
        options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
        options.SerializerSettings.DateTimeZoneHandling = DateTimeZoneHandling.Utc;
    });

/// <summary>
/// 配置 API 行为选项
/// - 禁用自动模型验证响应，允许自定义验证错误处理
/// - 配置问题详情的客户端错误映射
/// </summary>
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.SuppressModelStateInvalidFilter = false;
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value!.Errors.Count > 0)
            .SelectMany(e => e.Value!.Errors.Select(err => new
            {
                Field = e.Key,
                Message = err.ErrorMessage
            }))
            .ToList();

        var problemDetails = new ValidationProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "请求参数验证失败",
            Detail = "请检查提交的数据格式",
            Instance = context.HttpContext.Request.Path
        };

        foreach (var error in errors)
        {
            problemDetails.Errors.Add(error.Field, new[] { error.Message });
        }

        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});
#endregion

#region Swagger/OpenAPI 配置
/// <summary>
/// 配置 API 资源版本管理和 Swagger 文档生成
/// </summary>
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    /// <summary>
    /// 配置 Swagger 文档基本信息
    /// OpenAPI 3.0 规范
    /// </summary>
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "场馆管理系统 API",
        Description = "场馆管理系统后端 Web API 接口文档，提供场馆、档期、活动、票务等核心业务功能",
        TermsOfService = new Uri("https://example.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "技术支持团队",
            Email = "support@venue.com",
            Url = new Uri("https://example.com/support")
        },
        License = new OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://example.com/license")
        }
    });

    /// <summary>
    /// 配置 XML 注释文件路径
    /// 包含控制器和实体类的 XML 文档注释
    /// </summary>
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath, true);
    }

    /// <summary>
    /// 启用 Swagger 注释过滤器
    /// 自动添加请求/响应示例和安全标注
    /// </summary>
    options.ExampleFilters();

    /// <summary>
    /// 配置 JWT Bearer 安全定义
    /// 用于 Swagger UI 的认证授权功能
    /// </summary>
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT 授权认证头信息。请在下方输入框中输入 'Bearer {token}'（注意中间有空格）\r\n\r\n" +
                      "示例: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    /// <summary>
    /// 配置 OAuth2 安全定义
    /// 支持客户端凭据和密码授权模式
    /// </summary>
    options.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Description = "OAuth2 授权认证，支持客户端凭据和密码模式",
        Flows = new OpenApiOAuthFlows
        {
            ClientCredentials = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("/api/auth/token", UriKind.Relative),
                Scopes = new Dictionary<string, string>
                {
                    { "api:read", "读取 API 权限" },
                    { "api:write", "写入 API 权限" },
                    { "api:admin", "管理员权限" }
                }
            },
            Password = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("/api/auth/login", UriKind.Relative),
                Scopes = new Dictionary<string, string>
                {
                    { "api:read", "读取 API 权限" },
                    { "api:write", "写入 API 权限" }
                }
            }
        }
    });

    /// <summary>
    /// 配置安全要求
    /// 全局应用 JWT 认证要求
    /// </summary>
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
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

    /// <summary>
    /// 配置标签排序和文档分组
    /// </summary>
    options.OrderActionsBy((apiDesc) => $"{apiDesc.ActionDescriptor.RouteValues["controller"]}_{apiDesc.HttpMethod}");
    options.DocInclusionPredicate((docName, apiDesc) => true);

    /// <summary>
    /// 启用 Schema 过滤器，处理枚举类型显示
    /// </summary>
    options.DescribeAllParametersInCamelCase();
    options.UseInlineDefinitionsForEnums();
});

/// <summary>
/// 注册 Swagger 示例过滤器服务
/// </summary>
builder.Services.AddSwaggerExamplesFromAssemblies(Assembly.GetEntryAssembly());
#endregion

#region Redis 缓存配置
/// <summary>
/// 配置 Redis 连接多路复用器
/// 使用 StackExchange.Redis 库作为单例连接管理
/// 支持连接字符串配置、连接超时、同步超时等参数
/// </summary>
var redisConfiguration = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,defaultDatabase=0,connectTimeout=5000,syncTimeout=1000";
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = ConfigurationOptions.Parse(redisConfiguration);
    configuration.ResolveDns = true;
    configuration.AbortOnConnectFail = false;
    configuration.ConnectRetry = 3;
    configuration.ReconnectRetryPolicy = new LinearRetry(5000);

    return ConnectionMultiplexer.Connect(configuration);
});

/// <summary>
/// 注册 Redis 数据库访问服务
/// 从连接多路复用器获取数据库实例
/// </summary>
builder.Services.AddScoped<IDatabase>(sp =>
{
    var multiplexer = sp.GetRequiredService<IConnectionMultiplexer>();
    return multiplexer.GetDatabase();
});

/// <summary>
/// 注册分布式缓存服务（可选，兼容 IDistributedCache 接口）
/// </summary>
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConfiguration;
    options.InstanceName = "VenueSystem:";
});
#endregion

#region JWT 认证配置
/// <summary>
/// 配置 JWT 认证服务
/// 支持 Bearer Token 认证方式
/// </summary>
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    /// <summary>
    /// 从配置文件读取 JWT 设置
    /// 包含密钥、发行者、受众等配置项
    /// </summary>
    var jwtSettings = builder.Configuration.GetSection("Jwt");
    var secretKey = jwtSettings["SecretKey"] ?? "ThisIsAStrongSecretKeyForVenueManagementSystem1234567890";
    var issuer = jwtSettings["Issuer"] ?? "VenueManagementSystem";
    var audience = jwtSettings["Audience"] ?? "VenueSystemUsers";

    options.TokenValidationParameters = new TokenValidationParameters
    {
        /// <summary>
        /// 验证发行者
        /// 确保 Token 由可信的发行者签发
        /// </summary>
        ValidateIssuer = true,
        ValidIssuer = issuer,

        /// <summary>
        /// 验证受众
        /// 确保 Token 适用于本系统
        /// </summary>
        ValidateAudience = true,
        ValidAudience = audience,

        /// <summary>
        /// 验证签名
        /// 使用密钥验证 Token 完整性
        /// </summary>
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),

        /// <summary>
        /// 验证 Token 有效期
        /// 防止过期 Token 被使用
        /// </summary>
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero,

        /// <summary>
        /// 要求 Token 包含过期时间
        /// </summary>
        RequireExpirationTime = true
    };

    /// <summary>
    /// 配置 JWT 认证事件处理
    /// 处理认证失败、Token 过期等场景
    /// </summary>
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
            {
                context.Response.Headers.Append("Token-Expired", "true");
            }
            return Task.CompletedTask;
        },
        OnChallenge = context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";

            var result = JsonConvert.SerializeObject(new
            {
                status = 401,
                message = "未授权访问，请提供有效的认证令牌",
                error = string.IsNullOrEmpty(context.Error) ? "Unauthorized" : context.Error,
                errorDescription = context.ErrorDescription
            });

            return context.Response.WriteAsync(result);
        }
    };
});

/// <summary>
/// 配置授权策略
/// 支持基于角色和声明的授权
/// </summary>
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireRole("Admin");
        policy.RequireClaim("Permission", "System.Manage");
    });

    options.AddPolicy("Manager", policy =>
    {
        policy.RequireRole("Admin", "Manager");
    });

    options.AddPolicy("Staff", policy =>
    {
        policy.RequireRole("Admin", "Manager", "Staff");
    });
});
#endregion

#region CORS 配置
/// <summary>
/// 配置 CORS 策略
/// 允许前端开发环境地址跨域访问
/// </summary>
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        /// <summary>
        /// 允许的前端地址
        /// 开发环境：http://localhost:5173 (Vite 默认端口)
        /// </summary>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .WithExposedHeaders("Content-Disposition", "X-Pagination", "X-Total-Count");
    });

    /// <summary>
    /// 开发环境策略，允许所有来源（仅限开发使用）
    /// </summary>
    options.AddPolicy("AllowAllDevelopment", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
    });
});
#endregion

#region Hangfire 后台任务配置
/// <summary>
/// 配置 Hangfire 后台任务服务
/// 使用内存存储（开发环境），生产环境建议使用 SQL Server 或 Redis
/// </summary>
builder.Services.AddHangfire(configuration => configuration
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseMemoryStorage()
    .UseColouredConsoleLogProvider()
);

/// <summary>
/// 添加 Hangfire 服务端
/// 配置工作线程数量和任务处理参数
/// </summary>
builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount * 2;
    options.ServerName = "VenueManagementServer";
    options.SchedulePollingInterval = TimeSpan.FromSeconds(10);
    options.HeartbeatInterval = TimeSpan.FromSeconds(30);
    options.ServerTimeout = TimeSpan.FromMinutes(5);
    options.CancellationCheckInterval = TimeSpan.FromSeconds(5);
});
#endregion

#region 数据库上下文配置
/// <summary>
/// 配置 Entity Framework Core 数据上下文
/// 使用内存数据库用于开发测试
/// </summary>
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseInMemoryDatabase("VenueManagementDb");
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
    options.EnableDetailedErrors(builder.Environment.IsDevelopment());
});

/// <summary>
/// 注册 HttpClient 工厂
/// 用于票务系统 API 调用等外部服务通信
/// </summary>
builder.Services.AddHttpClient("TicketSystem", client =>
{
    client.BaseAddress = new Uri("https://api.ticket-system.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.DefaultRequestHeaders.Add("User-Agent", "VenueManagementSystem/1.0");
});

builder.Services.AddHttpClient("NotificationService", client =>
{
    client.BaseAddress = new Uri("https://api.notification.com/");
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});
#endregion

#region 服务依赖注入注册
/// <summary>
/// 注册业务服务（Scoped 生命周期）
/// 每个请求创建一个新的实例
/// </summary>
builder.Services.AddScoped<IVenueService, VenueService>();
builder.Services.AddScoped<IScheduleService, ScheduleService>();
builder.Services.AddScoped<IScheduleEngine, ScheduleEngine>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddScoped<IEmergencyService, EmergencyService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IRedisPublisher, RedisPublisher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IApprovalService, ApprovalService>();

/// <summary>
/// 注册后台任务服务
/// Hangfire 定时任务执行类
/// </summary>
builder.Services.AddScoped<ScheduleCacheUpdater>();
builder.Services.AddScoped<ApprovalReminder>();
builder.Services.AddScoped<TicketDataSyncer>();

/// <summary>
/// 注册 HTTP 上下文访问器
/// 用于在服务中访问当前请求上下文
/// </summary>
builder.Services.AddHttpContextAccessor();

/// <summary>
/// 配置响应压缩
/// 提高 API 响应性能
/// </summary>
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
#endregion

#region 应用构建
var app = builder.Build();
#endregion

#region 开发环境中间件配置
/// <summary>
/// 开发环境启用开发人员异常页
/// 显示详细的错误信息和堆栈跟踪
/// </summary>
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    /// <summary>
    /// 生产环境配置
    /// 启用 HSTS（HTTP Strict Transport Security）
    /// 强制客户端使用 HTTPS 连接
    /// </summary>
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
#endregion

#region HTTPS 重定向
/// <summary>
/// 启用 HTTPS 重定向
/// 将 HTTP 请求自动重定向到 HTTPS
/// </summary>
app.UseHttpsRedirection();
#endregion

#region Swagger 中间件
/// <summary>
/// 启用 Swagger 中间件
/// 生成 OpenAPI 3.0 规范文档
/// </summary>
app.UseSwagger(c =>
{
    c.SerializeAsV2 = false;
    c.RouteTemplate = "swagger/{documentName}/swagger.json";
});

/// <summary>
/// 启用 Swagger UI
/// 配置 OAuth2 认证支持和自定义 UI
/// </summary>
app.UseSwaggerUI(c =>
{
    /// <summary>
    /// 配置 Swagger 文档端点
    /// </summary>
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "场馆管理系统 API v1");
    c.RoutePrefix = "swagger";

    /// <summary>
    /// 配置文档标题和样式
    /// </summary>
    c.DocumentTitle = "场馆管理系统 API 文档";
    c.DisplayRequestDuration();
    c.EnableFilter();
    c.ShowExtensions();
    c.EnableValidator();
    c.SupportedSubmitMethods(SubmitMethod.Get, SubmitMethod.Post, SubmitMethod.Put, SubmitMethod.Delete, SubmitMethod.Patch);

    /// <summary>
    /// 配置 OAuth2 客户端设置
    /// 支持在 Swagger UI 中进行认证
    /// </summary>
    c.OAuthClientId("swagger-ui");
    c.OAuthClientSecret("swagger-ui-secret");
    c.OAuthUsePkce();
    c.OAuthScopeSeparator(" ");
    c.OAuth2RedirectUrl("http://localhost:5000/swagger/oauth2-redirect.html");

    /// <summary>
    /// 配置默认的 Bearer Token 输入框
    /// </summary>
    c.DefaultModelsExpandDepth(-1);
});
#endregion

#region 响应压缩中间件
/// <summary>
/// 启用响应压缩
/// 减少网络传输数据量
/// </summary>
app.UseResponseCompression();
#endregion

#region CORS 中间件
/// <summary>
/// 启用 CORS 中间件
/// 必须在 UseRouting 之后、UseAuthorization 之前
/// </summary>
app.UseCors("AllowFrontend");
#endregion

#region 路由中间件
/// <summary>
/// 启用路由中间件
/// 匹配请求到对应的端点
/// </summary>
app.UseRouting();
#endregion

#region 认证与授权中间件
/// <summary>
/// 启用认证中间件
/// 验证用户身份
/// 注意：必须在 UseAuthorization 之前
/// </summary>
app.UseAuthentication();

/// <summary>
/// 启用授权中间件
/// 验证用户是否有权限访问资源
/// </summary>
app.UseAuthorization();
#endregion

#region Hangfire Dashboard
/// <summary>
/// 启用 Hangfire 仪表板
/// 访问路径：/hangfire
/// 监控后台任务执行状态
/// </summary>
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    DashboardTitle = "场馆管理系统 - 后台任务管理",
    AppPath = "/swagger",
    StatsPollingInterval = 10000,

    /// <summary>
    /// 配置仪表板访问权限
    /// 仅允许本地访问或已认证的管理员访问
    /// </summary>
    Authorization = new[]
    {
        new Hangfire.Dashboard.LocalRequestsOnlyAuthorizationFilter()
    },

    /// <summary>
    /// 配置显示的作业列表页大小
    /// </summary>
    DisplayStorageConnectionString = false,
    DisplayNameFunc = (job, jobType, method, args) =>
    {
        return jobType.GetCustomAttribute<DisplayNameAttribute>()?.DisplayName ?? method.Name;
    }
});
#endregion

#region 控制器端点映射
/// <summary>
/// 映射控制器端点
/// 使用属性路由配置 API 路由
/// </summary>
app.MapControllers();

/// <summary>
/// 映射默认健康检查端点
/// </summary>
app.MapGet("/health", () => new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow,
    version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0"
})
.WithName("HealthCheck")
.WithOpenApi()
.AllowAnonymous();
#endregion

#region Hangfire 定时任务配置
/// <summary>
/// 初始化 Hangfire 定时任务
/// 在应用启动时添加或更新 recurring jobs
/// </summary>
using (var scope = app.Services.CreateScope())
{
    var jobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

    /// <summary>
    /// 每分钟执行一次：档期缓存更新任务
    /// 实时更新档期缓存，确保前端展示最新数据
    /// </summary>
    jobManager.AddOrUpdate<ScheduleCacheUpdater>(
        "schedule-cache-updater",
        job => job.ExecuteAsync(),
        "* * * * *",
        new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Utc
        }
    );

    /// <summary>
    /// 每5分钟执行一次：审批超时提醒任务
    /// 检查待审批的申请，超时自动发送提醒通知
    /// </summary>
    jobManager.AddOrUpdate<ApprovalReminder>(
        "approval-reminder",
        job => job.ExecuteAsync(),
        "*/5 * * * *",
        new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Utc
        }
    );

    /// <summary>
    /// 每15分钟执行一次：票务数据同步任务
    /// 与第三方票务系统同步销售数据和核销记录
    /// </summary>
    jobManager.AddOrUpdate<TicketDataSyncer>(
        "ticket-data-syncer",
        job => job.ExecuteAsync(),
        "*/15 * * * *",
        new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Utc
        }
    );

    /// <summary>
    /// 立即触发一次缓存预热（可选）
    /// 应用启动时立即执行一次缓存更新
    /// </summary>
    var backgroundJobClient = scope.ServiceProvider.GetRequiredService<IBackgroundJobClient>();
    backgroundJobClient.Enqueue<ScheduleCacheUpdater>(job => job.ExecuteAsync());
}
#endregion

#region 应用启动
/// <summary>
/// 启动 Web 应用
/// 开始监听并处理请求
/// </summary>
app.Run();
#endregion
