package com.carbon.gateway.security;

import com.carbon.common.context.UserContextHolder;
import com.carbon.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RequiredArgsConstructor
public class JwtReactiveAuthenticationFilter implements WebFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_TENANT_NAME = "X-Tenant-Name";
    public static final String HEADER_AUTHORITIES = "X-JWT-Authorities";

    private static final List<String> PERMIT_PATHS = List.of(
            "/actuator", "/swagger-ui", "/v3/api-docs", "/swagger-resources", "/api/auth"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (PERMIT_PATHS.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return sendUnauthorized(exchange, "Missing or invalid Authorization header");
        }

        UserContextHolder.CurrentUser user;
        try {
            String token = authHeader.substring(7);
            user = jwtTokenProvider.parseToken(token);
        } catch (Exception e) {
            log.debug("JWT authentication failed: {}", e.getMessage());
            return sendUnauthorized(exchange, "Token invalid or expired");
        }
        if (user == null || user.getTenantId() == null || user.getUserId() == null) {
            return sendUnauthorized(exchange, "Invalid token payload");
        }

        List<String> authorityList = user.getRoles() != null
                ? List.copyOf(user.getRoles()) : List.of();
        String authoritiesStr = String.join(",", authorityList);

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        user,
                        authHeader.substring(7),
                        authorityList.stream()
                                .map(SimpleGrantedAuthority::new)
                                .collect(Collectors.toList())
                );

        ServerWebExchange mutated = exchange.mutate()
                .request(b -> {
                    b.header(HEADER_TENANT_ID, user.getTenantId());
                    b.header(HEADER_USER_ID, user.getUserId());
                    if (user.getTenantName() != null) {
                        b.header(HEADER_TENANT_NAME, user.getTenantName());
                    }
                    if (!authorityList.isEmpty()) {
                        b.header(HEADER_AUTHORITIES, authoritiesStr);
                    }
                })
                .build();

        return chain.filter(mutated)
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(authentication))
                .contextWrite(ctx -> ctx.put("currentUser", user));
    }

    private Mono<Void> sendUnauthorized(ServerWebExchange exchange, String msg) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"code\":401,\"message\":\"" + msg + "\"}";
        return exchange.getResponse()
                .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body.getBytes())));
    }
}
