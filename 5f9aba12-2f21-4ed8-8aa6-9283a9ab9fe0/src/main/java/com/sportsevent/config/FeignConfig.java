package com.sportsevent.config;

import feign.Request;
import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class FeignConfig {

    @Bean
    public Request.Options feignOptions() {
        return new Request.Options(
                5000, TimeUnit.MILLISECONDS,
                10000, TimeUnit.MILLISECONDS,
                true
        );
    }

    @Bean
    public RequestInterceptor requestInterceptor() {
        return new RequestInterceptor() {
            @Override
            public void apply(RequestTemplate template) {
                template.header("Content-Type", "application/json");
            }
        };
    }
}
