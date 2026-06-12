package com.carbon.gateway.security;

import com.carbon.common.context.UserContextHolder;
import com.carbon.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.stream.Collectors;

@Slf4j
@RequiredArgsConstructor
public class JwtReactiveAuthenticationFilter implements WebFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_AUTHORITIES = "X-JWT-Authorities";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return chain.filter(exchange);
        }

        try {
            String token = authHeader.substring(7);
            UserContextHolder.CurrentUser user = jwtTokenProvider.parseToken(token);
            if (user == null) {
                return chain.filter(exchange);
            }

            java.util.List<String> authorityList = user.getRoles() != null ? user.getRoles() : java.util.Collections.emptyList();
            String authoritiesStr = String.join(",", authorityList);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            user,
                            token,
                            authorityList.stream()
                                    .map(SimpleGrantedAuthority::new)
                                    .collect(Collectors.toList())
                    );

            ServerWebExchange mutated = exchange.mutate()
                    .request(b -> {
                        b.header(HEADER_TENANT_ID, user.getTenantId());
                        b.header(HEADER_USER_ID, user.getUserId());
                        if (!authorityList.isEmpty()) {
                            b.header(HEADER_AUTHORITIES, authoritiesStr);
                        }
                    })
                    .build();

            return chain.filter(mutated)
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(authentication))
                    .contextWrite(ctx -> ctx.put("currentUser", user));
        } catch (Exception e) {
            log.debug("JWT authentication failed: {}", e.getMessage());
            return chain.filter(exchange);
        }
    }
}
