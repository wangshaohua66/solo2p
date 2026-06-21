using System.Reflection;
using Microsoft.OpenApi.Models;

namespace UsedVehicleTransaction.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddCustomSwagger(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "二手车交易服务中心 API",
                Version = "v1",
                Description = "某区域二手车交易服务中心后端服务接口文档，涵盖车辆准入审核、技术状况鉴定、档案管理、过户流程引擎、异常案件管理、统计分析等模块。",
                Contact = new OpenApiContact
                {
                    Name = "技术支持",
                    Email = "support@example.com"
                }
            });

            var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
            var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
            if (File.Exists(xmlPath))
            {
                c.IncludeXmlComments(xmlPath, true);
            }

            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "请输入JWT Token: Bearer {token}",
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

            c.OrderActionsBy((apiDesc) => $"{apiDesc.ActionDescriptor.RouteValues["controller"]}_{apiDesc.HttpMethod}");

            c.MapType<IFormFile>(() => new OpenApiSchema { Type = "string", Format = "binary" });
        });

        return services;
    }

    public static IApplicationBuilder UseCustomSwagger(this IApplicationBuilder app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "二手车交易服务中心 API v1");
            c.RoutePrefix = "swagger";
            c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
            c.DefaultModelsExpandDepth(-1);
            c.EnableFilter();
            c.DisplayRequestDuration();
            c.ShowExtensions();
        });
        return app;
    }
}
