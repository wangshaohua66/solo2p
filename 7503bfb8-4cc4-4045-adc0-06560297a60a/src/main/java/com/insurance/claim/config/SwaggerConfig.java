package com.insurance.claim.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.Arrays;
import java.util.List;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI claimManagementOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("保险理赔管理系统 API")
                        .description("统一保险理赔管理后端API，实现理赔全流程数字化、定损标准统一化、核赔风险智能化、赔款计算自动化、欺诈识别实时化")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("理赔系统开发团队")
                                .email("claim-support@insurance.com")
                        )
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")
                        )
                )
                .tags(Arrays.asList(
                        new Tag().name("1-认证管理").description("用户登录、注册、令牌管理"),
                        new Tag().name("2-理赔报案").description("理赔报案登记、保单校验、材料上传"),
                        new Tag().name("3-查勘调度").description("查勘派工、现场查勘、GPS校验"),
                        new Tag().name("4-定损评估").description("损失评估、配件定价、多方责任分摊"),
                        new Tag().name("5-核赔审核").description("核赔审核、案件分级、补充材料"),
                        new Tag().name("6-赔款计算").description("赔款自动计算、明细单生成"),
                        new Tag().name("7-支付结算").description("赔款支付、分期支付、电子凭证"),
                        new Tag().name("8-欺诈检测").description("欺诈识别、风险评分、可疑案件"),
                        new Tag().name("9-统计分析").description("理赔统计、赔付率分析、报表生成")
                ))
                .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
                .components(new Components()
                        .addSecuritySchemes("Bearer Authentication",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .in(SecurityScheme.In.HEADER)
                                        .name("Authorization")
                                        .description("JWT令牌认证，格式：Bearer {token}")
                        )
                );
    }
}
