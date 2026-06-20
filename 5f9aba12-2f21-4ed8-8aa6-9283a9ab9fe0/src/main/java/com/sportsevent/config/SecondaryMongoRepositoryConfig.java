package com.sportsevent.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@Configuration
@EnableMongoRepositories(
        basePackages = "com.sportsevent.repository.readonly",
        mongoTemplateRef = "secondaryMongoTemplate"
)
public class SecondaryMongoRepositoryConfig {
}
