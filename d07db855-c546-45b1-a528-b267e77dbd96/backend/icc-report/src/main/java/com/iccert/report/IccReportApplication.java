package com.iccert.report;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"com.iccert.report", "com.iccert.common"})
@EnableDiscoveryClient
@EnableScheduling
@EnableAsync
@MapperScan("com.iccert.report.mapper")
public class IccReportApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccReportApplication.class, args);
    }
}
