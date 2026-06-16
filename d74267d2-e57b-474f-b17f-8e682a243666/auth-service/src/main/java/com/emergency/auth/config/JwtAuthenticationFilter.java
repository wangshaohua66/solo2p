package com.emergency.auth.config;

import com.emergency.common.dto.LoginUser;
import com.emergency.common.enums.OrganizationLevel;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;
    private static final String TOKEN_HEADER = "Authorization";
    private static final String TOKEN_PREFIX = "Bearer ";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String userId = request.getHeader("X-User-Id");
        String username = request.getHeader("X-Username");
        String orgId = request.getHeader("X-Organization-Id");
        String orgLevel = request.getHeader("X-Organization-Level");
        String regionCode = request.getHeader("X-Region-Code");

        if (StringUtils.hasText(userId)) {
            String token = request.getHeader(TOKEN_HEADER);
            if (token != null && token.startsWith(TOKEN_PREFIX)) {
                token = token.substring(TOKEN_PREFIX.length());
                String jti = getJtiFromToken(token);
                if (Boolean.TRUE.equals(redisTemplate.hasKey("auth:token:blacklist:" + jti))) {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    return;
                }
            }

            LoginUser loginUser = LoginUser.builder()
                    .userId(Long.parseLong(userId))
                    .username(username)
                    .organizationId(StringUtils.hasText(orgId) ? Long.parseLong(orgId) : null)
                    .organizationLevel(StringUtils.hasText(orgLevel) ? Integer.parseInt(orgLevel) : OrganizationLevel.COUNTY.getCode())
                    .regionCode(regionCode)
                    .build();

            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            String authoritiesKey = "auth:authorities:" + userId;
            String cachedAuthorities = redisTemplate.opsForValue().get(authoritiesKey);
            if (cachedAuthorities != null) {
                for (String auth : cachedAuthorities.split(",")) {
                    authorities.add(new SimpleGrantedAuthority(auth));
                }
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(loginUser, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        chain.doFilter(request, response);
    }

    private String getJtiFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length == 3) {
                java.util.Base64.Decoder decoder = java.util.Base64.getUrlDecoder();
                String payload = new String(decoder.decode(parts[1]));
                com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(payload);
                return node.get("jti").asText();
            }
        } catch (Exception e) {
            log.warn("解析JWT jti失败", e);
        }
        return null;
    }
}
