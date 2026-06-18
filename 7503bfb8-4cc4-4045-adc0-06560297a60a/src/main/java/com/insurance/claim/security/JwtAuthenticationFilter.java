package com.insurance.claim.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenUtil jwtTokenUtil;

    public JwtAuthenticationFilter(JwtTokenUtil jwtTokenUtil) {
        this.jwtTokenUtil = jwtTokenUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader(jwtTokenUtil.getHeader());

        if (StringUtils.hasText(authHeader) && authHeader.startsWith(jwtTokenUtil.getPrefix())) {
            String token = authHeader.substring(jwtTokenUtil.getPrefix().length()).trim();

            try {
                if (StringUtils.hasText(token) && !jwtTokenUtil.isTokenExpired(token)) {
                    String username = jwtTokenUtil.getUsernameFromToken(token);
                    String role = jwtTokenUtil.getRoleFromToken(token);
                    Long userId = jwtTokenUtil.getUserIdFromToken(token);

                    if (StringUtils.hasText(username) && SecurityContextHolder.getContext().getAuthentication() == null) {
                        List<SimpleGrantedAuthority> authorities = Collections.singletonList(
                                new SimpleGrantedAuthority(role)
                        );

                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        username,
                                        null,
                                        authorities
                                );
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        authentication.setDetails(userId);

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        log.debug("设置用户认证: {} - {}", username, role);
                    }
                }
            } catch (Exception e) {
                log.warn("JWT认证失败: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
