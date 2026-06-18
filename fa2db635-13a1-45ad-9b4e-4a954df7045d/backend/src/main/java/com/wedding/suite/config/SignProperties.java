package com.wedding.suite.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "wedding.sign")
public class SignProperties {
    private String provider = "none";
    private Esign esign = new Esign();

    @Data
    public static class Esign {
        private String appId = "";
        private String appSecret = "";
        private String baseUrl = "";
        private String templateId = "";
    }
}
