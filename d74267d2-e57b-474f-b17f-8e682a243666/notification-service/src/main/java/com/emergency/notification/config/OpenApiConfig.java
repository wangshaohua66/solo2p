package com.emergency.notification.config;

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
                        .title("预警通知推送服务 API")
                        .version("1.0.0")
                        .description("省级应急管理指挥系统 - 预警通知推送服务接口文档\n\n" +
                                "提供多通道通知下发、回执追踪、模板管理、目标匹配等功能。\n\n" +
                                "**核心特性**:\n" +
                                "- 多通道下发（短信、App推送、应急广播）\n" +
                                "- 按灾害类型和影响范围匹配通知对象\n" +
                                "- 通知状态实时追踪（发送/送达/已读）\n" +
                                "- 确认回执追踪机制\n" +
                                "- 通知模板变量替换\n" +
                                "- 异步发送提升性能\n" +
                                "- II级及以上灾情自动三通道广播")
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
    public GroupedOpenApi notificationApi() {
        return GroupedOpenApi.builder()
                .group("通知管理")
                .pathsToMatch("/notifications/**")
                .description("通知发送、查询、回执确认、广播")
                .build();
    }

    @Bean
    public GroupedOpenApi templateApi() {
        return GroupedOpenApi.builder()
                .group("模板管理")
                .pathsToMatch("/templates/**")
                .description("通知模板查询、管理")
                .build();
    }

    @Bean
    public GroupedOpenApi receiptApi() {
        return GroupedOpenApi.builder()
                .group("回执管理")
                .pathsToMatch("/receipts/**")
                .description("通知回执查询、统计")
                .build();
    }
}
