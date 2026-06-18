package com.wedding.suite.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "wedding.sms")
public class SmsProperties {
    private String provider = "none";
    private Aliyun aliyun = new Aliyun();
    private Tencent tencent = new Tencent();

    @Data
    public static class Aliyun {
        private String accessKeyId = "";
        private String accessKeySecret = "";
        private String signName = "";
        private String templateCode = "";
    }

    @Data
    public static class Tencent {
        private String secretId = "";
        private String secretKey = "";
        private String sdkAppId = "";
        private String signName = "";
        private long templateId = 0;
        private String region = "ap-guangzhou";
    }
}
