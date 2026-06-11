package com.scriptkill;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ScriptKillApplication {

    public static void main(String[] args) {
        SpringApplication.run(ScriptKillApplication.class, args);
    }
}
