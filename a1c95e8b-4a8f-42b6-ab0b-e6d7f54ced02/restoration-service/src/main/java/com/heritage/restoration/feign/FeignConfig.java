package com.heritage.restoration.feign;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;

@Configuration
public class FeignConfig implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest req = attrs.getRequest();
            String auth = req.getHeader("Authorization");
            if (auth != null) {
                template.header("Authorization", auth);
            }
            String userId = req.getHeader("X-User-Id");
            if (userId != null) template.header("X-User-Id", userId);
            String userName = req.getHeader("X-Username");
            if (userName != null) template.header("X-Username", userName);
        }
    }
}
