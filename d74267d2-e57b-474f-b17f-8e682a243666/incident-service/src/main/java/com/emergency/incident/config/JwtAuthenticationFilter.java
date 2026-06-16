package com.emergency.incident.config;

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

import com.emergency.common.dto.LoginUser;
import com.emergency.common.enums.OrganizationLevel;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String userId = request.getHeader("X-User-Id");
        String username = request.getHeader("X-Username");
        String orgId = request.getHeader("X-Organization-Id");
        String orgLevel = request.getHeader("X-Organization-Level");
        String regionCode = request.getHeader("X-Region-Code");

        if (StringUtils.hasText(userId)) {
            LoginUser loginUser = LoginUser.builder()
                    .userId(Long.parseLong(userId))
                    .username(username)
                    .organizationId(StringUtils.hasText(orgId) ? Long.parseLong(orgId) : null)
                    .organizationLevel(StringUtils.hasText(orgLevel) ? Integer.parseInt(orgLevel) : OrganizationLevel.COUNTY.getCode())
                    .regionCode(regionCode)
                    .build();

            List<SimpleGrantedAuthority> authorities = new ArrayList<>();

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(loginUser, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        chain.doFilter(request, response);
    }
}
