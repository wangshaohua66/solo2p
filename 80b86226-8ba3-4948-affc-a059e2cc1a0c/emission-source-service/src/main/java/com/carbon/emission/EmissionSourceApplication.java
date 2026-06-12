package com.carbon.emission;

import com.carbon.common.security.JwtTokenProvider;
import com.carbon.common.web.TenantContextFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

import java.util.List;

@SpringBootApplication
@EnableDiscoveryClient
public class EmissionSourceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EmissionSourceApplication.class, args);
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
