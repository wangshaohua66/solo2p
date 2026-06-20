package com.freshcommunity;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.freshcommunity.mapper")
@EnableScheduling
public class FreshCommunityApplication {

    public static void main(String[] args) {
        SpringApplication.run(FreshCommunityApplication.class, args);
    }
}
