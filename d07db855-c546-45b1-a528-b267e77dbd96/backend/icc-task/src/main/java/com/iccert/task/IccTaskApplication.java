package com.iccert.task;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"com.iccert.task", "com.iccert.common"})
@EnableDiscoveryClient
@EnableScheduling
@MapperScan("com.iccert.task.mapper")
public class IccTaskApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccTaskApplication.class, args);
    }
}
