package com.sportsevent.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@Configuration
@EnableMongoRepositories(
        basePackages = {
                "com.sportsevent.repository"
        },
        excludeFilters = @org.springframework.context.annotation.ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.REGEX,
                pattern = "com\\.sportsevent\\.repository\\.readonly\\..*"
        ),
        mongoTemplateRef = "mongoTemplate"
)
public class MongoRepositoryConfig {
}

