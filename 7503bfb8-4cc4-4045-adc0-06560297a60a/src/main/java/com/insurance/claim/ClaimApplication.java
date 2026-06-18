package com.insurance.claim;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableTransactionManagement
@EnableAsync
@EnableCaching
@MapperScan("com.insurance.claim.mapper")
public class ClaimApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClaimApplication.class, args);
    }
}
