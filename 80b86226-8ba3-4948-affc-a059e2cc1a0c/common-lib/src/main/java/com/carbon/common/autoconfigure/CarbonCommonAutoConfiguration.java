package com.carbon.common.autoconfigure;

import com.carbon.common.audit.AuditLogAspect;
import com.carbon.common.config.CacheConfig;
import com.carbon.common.config.OpenApiConfig;
import com.carbon.common.config.TenantAuditorAware;
import com.carbon.common.config.TenantRoutingMongoDatabaseFactory;
import com.carbon.common.config.TenantTransactionAspect;
import com.carbon.common.exception.GlobalExceptionHandler;
import com.carbon.common.integration.WebhookNotifier;
import com.carbon.common.security.JwtTokenProvider;
import com.mongodb.client.MongoClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.transaction.PlatformTransactionManager;

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

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(MongoClient.class)
    public MongoDatabaseFactory mongoDatabaseFactory(
            MongoClient mongoClient,
            @Value("${spring.data.mongodb.database:carbon}") String database,
            @Value("${carbon.mongo.tenant-prefix:carbon_}") String tenantPrefix) {
        return new TenantRoutingMongoDatabaseFactory(mongoClient, database, tenantPrefix);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "org.springframework.data.mongodb.core.MongoTemplate")
    public MongoTemplate mongoTemplate(MongoDatabaseFactory factory) {
        return new MongoTemplate(factory);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "org.springframework.transaction.PlatformTransactionManager")
    public PlatformTransactionManager mongoTransactionManager(MongoDatabaseFactory factory) {
        return new MongoTransactionManager(factory);
    }
}
