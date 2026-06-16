package com.emergency.inventory.config;

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
                        .title("物资仓储管理服务 API")
                        .version("1.0.0")
                        .description("省级应急管理指挥系统 - 物资仓储管理服务接口文档\n\n" +
                                "提供仓库管理、库存管理、物资锁定、紧急调拨、最优路线计算等功能。\n\n" +
                                "**核心特性**:\n" +
                                "- 多仓库库存实时联动查询\n" +
                                "- 基于PostGIS的最近仓库匹配\n" +
                                "- 分布式锁防止库存超卖\n" +
                                "- 按灾情等级自动锁定库存\n" +
                                "- 最优调拨路线算法\n" +
                                "- 库存预警阈值管理")
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
    public GroupedOpenApi warehouseApi() {
        return GroupedOpenApi.builder()
                .group("仓库管理")
                .pathsToMatch("/warehouses/**")
                .description("仓库信息查询、管理")
                .build();
    }

    @Bean
    public GroupedOpenApi materialApi() {
        return GroupedOpenApi.builder()
                .group("物资管理")
                .pathsToMatch("/materials/**")
                .description("物资品类信息查询、管理")
                .build();
    }

    @Bean
    public GroupedOpenApi stockApi() {
        return GroupedOpenApi.builder()
                .group("库存管理")
                .pathsToMatch("/stocks/**")
                .description("库存查询、锁定、解锁、确认调拨")
                .build();
    }

    @Bean
    public GroupedOpenApi allocationApi() {
        return GroupedOpenApi.builder()
                .group("调拨管理")
                .pathsToMatch("/allocations/**")
                .description("物资调拨、路线计算、运输跟踪")
                .build();
    }
}
