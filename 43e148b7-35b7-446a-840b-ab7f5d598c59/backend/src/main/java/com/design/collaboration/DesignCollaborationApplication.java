package com.design.collaboration;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.design.collaboration.mapper")
public class DesignCollaborationApplication {

    public static void main(String[] args) {
        SpringApplication.run(DesignCollaborationApplication.class, args);
    }
}
