package com.carbon.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.headers.Header;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Configuration
public class OpenApiConfig {

    @Value("${springdoc.info.title:企业级碳排放管理平台 API}")
    private String title;

    @Value("${springdoc.info.version:1.0.0}")
    private String version;

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title(title)
                        .description("工业制造企业碳管理后端，覆盖核算、配额、核查、CCER、披露全流程，" +
                                "支持 ISO 14064-1 / GHG Protocol / CBAM 三套方法学并行核算")
                        .version(version)
                        .contact(new Contact()
                                .name("Carbon Management Team")
                                .email("carbon@enterprise.com"))
                        .license(new License().name("Commercial")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("本地开发环境"),
                        new Server().url("https://api.carbon.example.com").description("生产环境")
                ))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Authorization: Bearer {jwt-token}"))
                        .addHeaders("X-Trace-Id", new Header()
                                .description("链路追踪ID")
                                .schema(new StringSchema()))
                        .addHeaders("X-Tenant-Id", new Header()
                                .description("租户ID(可从JWT自动解析)")
                                .schema(new StringSchema()))
                        .schemas(Map.of(
                                "R", unifiedResponseSchema(),
                                "R_PageResult", pageResponseSchema()
                        )));
    }

    @SuppressWarnings("rawtypes")
    private Schema unifiedResponseSchema() {
        return new ObjectSchema()
                .description("统一响应结构")
                .addProperty("code", new IntegerSchema().description("业务状态码 0=成功"))
                .addProperty("message", new StringSchema().description("消息"))
                .addProperty("traceId", new StringSchema().description("链路追踪ID"))
                .addProperty("data", new Schema<>().description("业务数据"))
                .addProperty("timestamp", new StringSchema()
                        ._default(Instant.now().toString()).description("ISO-8601时间戳"));
    }

    @SuppressWarnings("rawtypes")
    private Schema pageResponseSchema() {
        return new ObjectSchema()
                .description("分页响应")
                .addProperty("content", new Schema<>().description("数据列表"))
                .addProperty("page", new IntegerSchema().description("页码"))
                .addProperty("size", new IntegerSchema().description("每页条数"))
                .addProperty("total", new IntegerSchema().description("总条数"))
                .addProperty("totalPages", new IntegerSchema().description("总页数"));
    }
}
