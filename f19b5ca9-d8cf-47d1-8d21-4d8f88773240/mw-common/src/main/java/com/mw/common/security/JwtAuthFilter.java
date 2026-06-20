package com.mw.common.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.AntPathMatcher;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class JwtAuthFilter {

    private final JwtUtil jwtUtil;

    @Value("${mw.security.permit-paths:/actuator/**,/v3/api-docs/**,/swagger-ui/**,/swagger-ui.html,/webjars/**,/doc.html,/auth/login,/auth/refresh,/auth/register}")
    private String permitPaths;

    private final AntPathMatcher matcher = new AntPathMatcher();

    @Bean
    public FilterRegistrationBean<jakarta.servlet.Filter> jwtFilterRegistration() {
        List<String> paths = Arrays.asList(permitPaths.split(","));
        FilterRegistrationBean<jakarta.servlet.Filter> reg = new FilterRegistrationBean<>();
        reg.setFilter((request, response, chain) -> doFilter((HttpServletRequest) request, (HttpServletResponse) response, chain, paths));
        reg.addUrlPatterns("/*");
        reg.setOrder(1);
        return reg;
    }

    private void doFilter(HttpServletRequest request, HttpServletResponse response, FilterChain chain,
                          List<String> permitPaths) throws IOException, ServletException {
        String uri = request.getRequestURI();
        boolean permitted = permitPaths.stream().anyMatch(p -> matcher.match(p.trim(), uri));
        if (permitted) {
            chain.doFilter(request, response);
            return;
        }
        String token = resolveToken(request);
        if (token != null) {
            Claims claims = jwtUtil.parse(token);
            if (claims != null) {
                UserInfo user = jwtUtil.toUserInfo(claims);
                if (user != null) {
                    UserContext.set(user);
                }
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
