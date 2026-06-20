package com.sportsevent.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI sportsEventOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("区域体育赛事运营平台 API")
                        .description("涵盖篮球、足球、羽毛球、乒乓球、网球5个项目的年度业余体育联赛管理系统。" +
                                "支持赛程自动编排、运动员报名资格审核、裁判智能指派、场地预约冲突管理、" +
                                "成绩录入排名计算、赛事通知推送等功能。")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("赛事运营技术团队")
                                .email("tech@sportsevent.com"))
                        .license(new License()
                                .name("Internal Use Only")
                                .url("https://sportsevent.com/license")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("开发环境"),
                        new Server().url("https://api.sportsevent.com").description("生产环境")
                ));
    }
}
