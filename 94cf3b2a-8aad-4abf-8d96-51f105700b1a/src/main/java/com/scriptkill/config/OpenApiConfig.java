package com.scriptkill.config;

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
public class OpenApiConfig {

    @Bean
    public OpenAPI scriptKillOpenAPI() {
        final String securitySchemeName = "bearer-jwt";
        return new OpenAPI()
            .info(new Info()
                .title("剧本杀店管理系统 API")
                .description("剧本杀店完整管理系统，包含剧本库、开本会话、拼场匹配、线索引擎、复盘评分、爽约风控、DM排班与本子采购评审等功能")
                .version("1.0.0")
                .contact(new Contact()
                    .name("技术支持")
                    .email("support@scriptkill.com"))
                .license(new License()
                    .name("MIT License")
                    .url("https://opensource.org/licenses/MIT")))
            .components(new Components()
                .addSecuritySchemes(securitySchemeName,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("JWT Authorization header using the Bearer scheme.")))
            .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
            .tags(Arrays.asList(
                new Tag().name("01-认证管理").description("用户登录注册与JWT认证"),
                new Tag().name("02-剧本管理").description("剧本库增删改查、角色卡、阶段、线索管理"),
                new Tag().name("03-开本会话").description("开本状态机、事件溯源、会话管理"),
                new Tag().name("04-拼场匹配").description("智能拼场算法与匹配方案"),
                new Tag().name("05-线索引擎").description("DM线索推送与时间轴回放"),
                new Tag().name("06-复盘评分").description("玩家评价与多维雷达图数据"),
                new Tag().name("07-预约与定金").description("玩家预约、定金、爽约风控"),
                new Tag().name("08-DM排班").description("DM排班与提成计算"),
                new Tag().name("09-本子采购").description("新本子评审与入库流程"),
                new Tag().name("10-玩家档案").description("玩家画像与偏好分析"),
                new Tag().name("11-数据统计").description("经营数据统计与分析")
            ));
    }
}
