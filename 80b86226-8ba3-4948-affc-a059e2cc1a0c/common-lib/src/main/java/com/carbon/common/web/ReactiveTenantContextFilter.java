package com.carbon.common.web;

import com.carbon.common.context.UserContextHolder;
import com.carbon.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;

@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
public class ReactiveTenantContextFilter implements WebFilter {

    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String ATTR_CURRENT_USER = "currentUser";

    private final JwtTokenProvider jwtTokenProvider;
    private final List<String> whitelist;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (isWhitelisted(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return chain.filter(exchange);
        }

        try {
            String token = authHeader.substring(7);
            UserContextHolder.CurrentUser user = jwtTokenProvider.parseToken(token);
            if (user != null) {
                UserContextHolder.set(user);
                ServerHttpRequest mutated = exchange.getRequest().mutate()
                        .header(HEADER_TENANT_ID, user.getTenantId())
                        .header(HEADER_USER_ID, user.getUserId())
                        .build();
                return chain.filter(exchange.mutate().request(mutated).build())
                        .contextWrite(ctx -> ctx.put(ATTR_CURRENT_USER, user))
                        .doFinally(signal -> UserContextHolder.clear());
            }
        } catch (Exception e) {
            log.debug("Reactive JWT parse failed: {}", e.getMessage());
        }

        return chain.filter(exchange);
    }

    private boolean isWhitelisted(String path) {
        if (whitelist == null) return false;
        for (String pattern : whitelist) {
            if (pathMatch(pattern, path)) return true;
        }
        return false;
    }

    private boolean pathMatch(String pattern, String path) {
        if (pattern.endsWith("/**")) {
            String prefix = pattern.substring(0, pattern.length() - 3);
            return path.startsWith(prefix);
        }
        if (pattern.endsWith("/*")) {
            String prefix = pattern.substring(0, pattern.length() - 2);
            return path.startsWith(prefix) && path.indexOf('/', prefix.length() + 1) == -1;
        }
        if (pattern.startsWith("POST:") || pattern.startsWith("GET:") || pattern.startsWith("PUT:")
                || pattern.startsWith("DELETE:") || pattern.startsWith("PATCH:") || pattern.startsWith("OPTIONS:")) {
            int idx = pattern.indexOf(':');
            String p = pattern.substring(idx + 1);
            return pathMatch(p, path);
        }
        return pattern.equals(path);
    }
}
