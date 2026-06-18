package com.wedding.suite.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "wedding.jwt")
public class JwtProperties {
    private String secret;
    private long accessTokenTtl;
    private String issuer;
}
