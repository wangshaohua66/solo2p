package com.tobacco;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.tobacco.mapper")
@EnableScheduling
public class TobaccoAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(TobaccoAdminApplication.class, args);
    }
}
