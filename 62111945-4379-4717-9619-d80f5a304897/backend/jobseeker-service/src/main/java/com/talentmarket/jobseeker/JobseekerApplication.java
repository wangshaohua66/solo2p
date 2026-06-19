package com.talentmarket.jobseeker;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@MapperScan("com.talentmarket.jobseeker.mapper")
public class JobseekerApplication {

    public static void main(String[] args) {
        SpringApplication.run(JobseekerApplication.class, args);
        System.out.println("========== 求职者服务启动成功 ==========");
    }
}
