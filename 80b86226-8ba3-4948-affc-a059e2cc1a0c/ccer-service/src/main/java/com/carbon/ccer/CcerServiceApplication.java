package com.carbon.ccer;

import com.carbon.common.security.JwtTokenProvider;
import com.carbon.common.web.TenantContextFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

import java.util.List;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
public class CcerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CcerServiceApplication.class, args);
    }

    @Bean
    public FilterRegistrationBean<TenantContextFilter> tenantContextFilter(JwtTokenProvider provider,
                                                                           @Value("${security.whitelist:}") List<String> wl) {
        FilterRegistrationBean<TenantContextFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new TenantContextFilter(provider, wl));
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        reg.addUrlPatterns("/*");
        return reg;
    }
}
