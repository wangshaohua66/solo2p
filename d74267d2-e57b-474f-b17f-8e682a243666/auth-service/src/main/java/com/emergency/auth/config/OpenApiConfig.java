package com.emergency.auth.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.media.StringSchema;
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
                        .title("认证授权服务 API")
                        .version("1.0.0")
                        .description("省级应急管理指挥系统 - 认证授权服务接口文档\n\n" +
                                "提供用户登录、令牌管理、组织架构、角色权限、审批流程等功能。\n\n" +
                                "**认证方式**: Bearer JWT Token\n\n" +
                                "**数据权限**: 省/市/县三级数据隔离")
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
                                        .description("JWT认证令牌，格式: Bearer {token}"))
                        .addHeaders("X-User-Id", new Header()
                                .description("当前用户ID（网关透传）")
                                .schema(new StringSchema()))
                        .addHeaders("X-Organization-Id", new Header()
                                .description("当前用户所属组织ID（网关透传）")
                                .schema(new StringSchema()))
                        .addHeaders("X-Region-Code", new Header()
                                .description("当前用户所属区域编码（网关透传）")
                                .schema(new StringSchema())));
    }

    @Bean
    public GroupedOpenApi authApi() {
        return GroupedOpenApi.builder()
                .group("认证管理")
                .pathsToMatch("/auth/**")
                .description("用户登录、登出、令牌刷新、密码修改")
                .build();
    }

    @Bean
    public GroupedOpenApi userApi() {
        return GroupedOpenApi.builder()
                .group("用户管理")
                .pathsToMatch("/users/**")
                .description("用户信息查询、修改、列表")
                .build();
    }

    @Bean
    public GroupedOpenApi organizationApi() {
        return GroupedOpenApi.builder()
                .group("组织管理")
                .pathsToMatch("/organizations/**")
                .description("省/市/县三级组织树管理")
                .build();
    }

    @Bean
    public GroupedOpenApi approvalApi() {
        return GroupedOpenApi.builder()
                .group("审批管理")
                .pathsToMatch("/approvals/**")
                .description("调度、调拨等业务审批流程")
                .build();
    }
}
