package com.carbon.common.autoconfigure;

import com.carbon.common.audit.AuditLogAspect;
import com.carbon.common.config.CacheConfig;
import com.carbon.common.config.OpenApiConfig;
import com.carbon.common.config.TenantAuditorAware;
import com.carbon.common.config.TenantTransactionAspect;
import com.carbon.common.exception.GlobalExceptionHandler;
import com.carbon.common.integration.WebhookNotifier;
import com.carbon.common.security.JwtTokenProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@Import({
        CacheConfig.class,
        OpenApiConfig.class,
        GlobalExceptionHandler.class,
        AuditLogAspect.class,
        TenantTransactionAspect.class,
        JwtTokenProvider.class,
        WebhookNotifier.class
})
@EnableMongoAuditing
@EnableAsync
public class CarbonCommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public AuditorAware<String> auditorProvider() {
        return new TenantAuditorAware();
    }
}
