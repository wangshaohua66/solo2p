package com.iccert.auth;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication(scanBasePackages = {"com.iccert.auth", "com.iccert.common"})
@EnableDiscoveryClient
@MapperScan("com.iccert.auth.mapper")
public class IccAuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccAuthApplication.class, args);
    }
}
