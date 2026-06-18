package com.iccert.analytics;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication(scanBasePackages = {"com.iccert.analytics", "com.iccert.common"})
@EnableDiscoveryClient
@MapperScan("com.iccert.analytics.mapper")
public class IccAnalyticsApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccAnalyticsApplication.class, args);
    }
}
