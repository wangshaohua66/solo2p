package com.carbon.gateway.ratelimit;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

@Configuration
public class RateLimiterConfig {

    @Bean
    @Primary
    public KeyResolver tenantKeyResolver() {
        return exchange -> {
            String tenantId = exchange.getRequest().getHeaders().getFirst("X-Tenant-Id");
            if (tenantId == null || tenantId.isEmpty()) {
                String clientIp = exchange.getRequest().getRemoteAddress() != null
                        ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                        : "unknown";
                return Mono.just("anon:" + clientIp);
            }
            return Mono.just("tenant:" + tenantId);
        };
    }

    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            if (userId == null || userId.isEmpty()) {
                return Mono.just("anon");
            }
            return Mono.just("user:" + userId);
        };
    }

    @Bean
    public KeyResolver apiKeyResolver() {
        return exchange -> Mono.just("api:" + exchange.getRequest().getPath().value());
    }
}
