package com.emergency.incident.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("灾情事件管理服务 API")
                        .version("1.0.0")
                        .description("省级应急管理指挥系统 - 灾情事件管理服务接口文档\n\n" +
                                "提供灾情上报、多源数据接入、自动分级、规则引擎、预案匹配、态势分析等功能。\n\n" +
                                "**核心特性**:\n" +
                                "- 多源数据接入（人工填报、气象API、传感器）\n" +
                                "- 按国标自动定级（I/II/III/IV级）\n" +
                                "- 规则引擎自动匹配应急预案\n" +
                                "- PostGIS空间查询（附近灾情、影响范围）\n" +
                                "- 灾情全生命周期管理（PENDING→CLOSED）\n" +
                                "- 操作日志全程留痕")
                        .contact(new Contact()
                                .name("应急管理厅技术组")
                                .email("tech@emergency.gov.cn"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .in(SecurityScheme.In.HEADER)
                                        .description("JWT认证令牌")));
    }

    @Bean
    public GroupedOpenApi incidentApi() {
        return GroupedOpenApi.builder()
                .group("灾情事件管理")
                .pathsToMatch("/incidents/**")
                .description("灾情上报、查询、更新、状态流转、定级升级")
                .build();
    }

    @Bean
    public GroupedOpenApi planApi() {
        return GroupedOpenApi.builder()
                .group("应急预案管理")
                .pathsToMatch("/response-plans/**")
                .description("应急预案查询、匹配、管理")
                .build();
    }

    @Bean
    public GroupedOpenApi logApi() {
        return GroupedOpenApi.builder()
                .group("操作日志")
                .pathsToMatch("/operation-logs/**", "/timeline")
                .description("灾情操作日志、时间轴回放")
                .build();
    }
}
