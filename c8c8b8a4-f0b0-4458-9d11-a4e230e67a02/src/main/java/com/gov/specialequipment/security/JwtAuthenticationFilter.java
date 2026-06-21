package com.gov.specialequipment.security;

import com.gov.specialequipment.entity.SysUser;
import com.gov.specialequipment.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader(jwtUtil.getHeader());

        if (authHeader != null && authHeader.startsWith(jwtUtil.getPrefix())) {
            String token = authHeader.substring(jwtUtil.getPrefix().length()).trim();
            try {
                if (jwtUtil.validateToken(token)) {
                    Claims claims = jwtUtil.parseToken(token);
                    Long userId = claims.get("userId", Long.class);
                    String username = claims.getSubject();
                    String roleCode = claims.get("roleCode", String.class);
                    Long organizationId = claims.get("organizationId", Long.class);
                    String realName = claims.get("realName", String.class);
                    String organizationName = claims.get("organizationName", String.class);

                    SysUser sysUser = new SysUser();
                    sysUser.setId(userId);
                    sysUser.setUsername(username);
                    sysUser.setRoleCode(roleCode);
                    sysUser.setOrganizationId(organizationId);
                    sysUser.setRealName(realName);
                    sysUser.setOrganizationName(organizationName);

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            sysUser,
                            null,
                            Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + roleCode))
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                log.warn("JWT token认证失败: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
