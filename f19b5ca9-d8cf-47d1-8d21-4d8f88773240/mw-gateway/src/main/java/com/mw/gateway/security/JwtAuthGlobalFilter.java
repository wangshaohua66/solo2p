package com.mw.gateway.security;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private final GatewayJwtUtil jwtUtil;

    private final AntPathMatcher matcher = new AntPathMatcher();

    private static final List<String> PERMIT_PATHS = List.of(
            "/auth/login",
            "/auth/refresh",
            "/auth/register",
            "/actuator/**",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/webjars/**"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        boolean permitted = PERMIT_PATHS.stream().anyMatch(p -> matcher.match(p, path));
        if (permitted) {
            return chain.filter(exchange);
        }

        String token = resolveToken(request);
        if (token == null) {
            return unauthorized(exchange, "缺少访问令牌");
        }
        Claims claims = jwtUtil.parse(token);
        if (claims == null || !"access".equals(claims.get("type"))) {
            return unauthorized(exchange, "令牌无效或已过期");
        }

        ServerHttpRequest mutated = request.mutate()
                .header("X-User-Id", String.valueOf(claims.getSubject()))
                .header("X-User-Name", String.valueOf(claims.getOrDefault("realName", claims.getSubject())))
                .header("X-Org-Id", String.valueOf(claims.getOrDefault("orgId", "")))
                .header("X-User-Roles", String.valueOf(claims.getOrDefault("roles", "")))
                .build();

        return chain.filter(exchange.mutate().request(mutated).build());
    }

    private String resolveToken(ServerHttpRequest request) {
        List<String> headers = request.getHeaders().get("Authorization");
        if (headers != null && !headers.isEmpty() && headers.get(0).startsWith("Bearer ")) {
            return headers.get(0).substring(7);
        }
        return null;
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        log.warn("网关鉴权失败: path={}, msg={}", exchange.getRequest().getURI().getPath(), message);
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
