package com.mw.supervision;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableDiscoveryClient
@EnableScheduling
@SpringBootApplication(scanBasePackages = "com.mw")
public class SupervisionApplication {

    public static void main(String[] args) {
        SpringApplication.run(SupervisionApplication.class, args);
    }
}
