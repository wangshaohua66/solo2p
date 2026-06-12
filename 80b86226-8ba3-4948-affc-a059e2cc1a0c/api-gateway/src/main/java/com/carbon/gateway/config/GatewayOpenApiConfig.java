package com.carbon.gateway.config;

import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayOpenApiConfig {

    @Bean
    public GroupedOpenApi authApi() {
        return GroupedOpenApi.builder()
                .group("认证服务")
                .pathsToMatch("/api/auth/**")
                .build();
    }

    @Bean
    public GroupedOpenApi emissionApi() {
        return GroupedOpenApi.builder()
                .group("排放源与活动数据")
                .pathsToMatch("/api/emission-sources/**", "/api/activity-data/**")
                .build();
    }

    @Bean
    public GroupedOpenApi factorApi() {
        return GroupedOpenApi.builder()
                .group("因子库")
                .pathsToMatch("/api/factors/**", "/api/factor-versions/**")
                .build();
    }

    @Bean
    public GroupedOpenApi calculationApi() {
        return GroupedOpenApi.builder()
                .group("核算引擎")
                .pathsToMatch("/api/calculations/**", "/api/calculation-tasks/**")
                .build();
    }

    @Bean
    public GroupedOpenApi quotaApi() {
        return GroupedOpenApi.builder()
                .group("配额履约")
                .pathsToMatch("/api/quotas/**", "/api/alerts/**", "/api/quota-ledgers/**")
                .build();
    }

    @Bean
    public GroupedOpenApi verificationApi() {
        return GroupedOpenApi.builder()
                .group("核查与披露")
                .pathsToMatch("/api/verifications/**", "/api/evidence/**", "/api/reports/**")
                .build();
    }

    @Bean
    public GroupedOpenApi ccerApi() {
        return GroupedOpenApi.builder()
                .group("CCER减排")
                .pathsToMatch("/api/ccer-projects/**", "/api/ccer-issuances/**")
                .build();
    }
}
