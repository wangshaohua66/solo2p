package com.wedding.suite.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "wedding.cors")
public class CorsProperties {
    private List<String> allowedOrigins;
}
