package com.mw.common.config;

import com.mw.common.security.UserContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

import java.util.Optional;

@Configuration
@EnableMongoAuditing
public class MongoAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> {
            String user = UserContext.currentUsername();
            return Optional.ofNullable(user);
        };
    }
}
