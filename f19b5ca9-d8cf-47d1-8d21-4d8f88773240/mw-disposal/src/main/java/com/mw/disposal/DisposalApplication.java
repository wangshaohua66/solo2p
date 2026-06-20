package com.mw.disposal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableDiscoveryClient
@EnableScheduling
@SpringBootApplication(scanBasePackages = "com.mw")
public class DisposalApplication {

    public static void main(String[] args) {
        SpringApplication.run(DisposalApplication.class, args);
    }
}
