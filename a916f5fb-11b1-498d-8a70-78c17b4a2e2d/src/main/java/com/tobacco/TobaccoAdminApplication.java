package com.tobacco;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.tobacco.mapper")
@EnableScheduling
@EnableDiscoveryClient
@EnableFeignClients
public class TobaccoAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(TobaccoAdminApplication.class, args);
    }
}
