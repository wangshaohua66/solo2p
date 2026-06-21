package com.gov.specialequipment;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
@MapperScan("com.gov.specialequipment.mapper")
public class SpecialEquipmentApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpecialEquipmentApplication.class, args);
    }
}
