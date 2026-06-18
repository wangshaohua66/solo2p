package com.iccert.sample;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"com.iccert.sample", "com.iccert.common"})
@EnableDiscoveryClient
@EnableScheduling
@MapperScan("com.iccert.sample.mapper")
public class IccSampleApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccSampleApplication.class, args);
    }
}
