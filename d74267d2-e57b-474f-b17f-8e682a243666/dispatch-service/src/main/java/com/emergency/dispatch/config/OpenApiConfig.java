package com.emergency.dispatch.config;

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
                        .title("救援力量调度服务 API")
                        .version("1.0.0")
                        .description("省级应急管理指挥系统 - 救援力量调度服务接口文档\n\n" +
                                "提供救援队伍管理、智能调度编组、冲突检测、跨区域调度、任务跟踪等功能。\n\n" +
                                "**核心特性**:\n" +
                                "- 基于距离和能力的智能编组算法\n" +
                                "- 分布式锁防止重复派兵\n" +
                                "- 跨区域调度冲突检测\n" +
                                "- 调度方案审批流程\n" +
                                "- 队伍任务状态实时追踪\n" +
                                "- 预计到达时间自动计算")
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
    public GroupedOpenApi dispatchApi() {
        return GroupedOpenApi.builder()
                .group("调度方案管理")
                .pathsToMatch("/dispatches/**")
                .description("调度方案生成、审批、执行、取消、冲突检测")
                .build();
    }

    @Bean
    public GroupedOpenApi teamApi() {
        return GroupedOpenApi.builder()
                .group("救援队伍管理")
                .pathsToMatch("/teams/**")
                .description("救援队伍查询、状态更新、可用队伍匹配")
                .build();
    }

    @Bean
    public GroupedOpenApi assignmentApi() {
        return GroupedOpenApi.builder()
                .group("队伍分配管理")
                .pathsToMatch("/assignments/**")
                .description("队伍分配、重新分配、任务跟踪")
                .build();
    }
}
