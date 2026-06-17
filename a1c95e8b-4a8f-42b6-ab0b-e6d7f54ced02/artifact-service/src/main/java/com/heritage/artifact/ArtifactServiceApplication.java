package com.heritage.artifact;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@EnableAsync
@EnableElasticsearchRepositories(basePackages = "com.heritage.artifact.repository")
public class ArtifactServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ArtifactServiceApplication.class, args);
    }
}
