package com.crew;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@MapperScan("com.crew.mapper")
@OpenAPIDefinition(
        info = @Info(
                title = "航空机组排班与疲劳监控系统 API",
                version = "v1.0",
                description = "Regional airline crew scheduling, fatigue monitoring and qualification compliance system",
                contact = @Contact(name = "Crew Scheduling Team"),
                license = @License(name = "Private")
        )
)
public class CrewApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrewApplication.class, args);
    }
}
