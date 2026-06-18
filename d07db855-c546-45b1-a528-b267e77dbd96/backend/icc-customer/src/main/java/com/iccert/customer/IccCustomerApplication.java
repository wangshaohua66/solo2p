package com.iccert.customer;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication(scanBasePackages = {"com.iccert.customer", "com.iccert.common"})
@EnableDiscoveryClient
@MapperScan("com.iccert.customer.mapper")
public class IccCustomerApplication {
    public static void main(String[] args) {
        SpringApplication.run(IccCustomerApplication.class, args);
    }
}
