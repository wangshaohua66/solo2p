package com.heritage.trace.feign;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Configuration
public class FeignHeaderConfig implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return;
        HttpServletRequest req = attrs.getRequest();
        String[] forwardHeaders = {"Authorization","X-User-Id","X-Username","X-Roles","X-Trace-Id"};
        for (String h : forwardHeaders) {
            String v = req.getHeader(h);
            if (v != null && !v.isEmpty()) template.header(h, v);
        }
    }
}
