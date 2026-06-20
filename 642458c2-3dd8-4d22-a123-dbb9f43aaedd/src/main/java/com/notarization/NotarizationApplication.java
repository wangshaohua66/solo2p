package com.notarization;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NotarizationApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotarizationApplication.class, args);
    }
}
