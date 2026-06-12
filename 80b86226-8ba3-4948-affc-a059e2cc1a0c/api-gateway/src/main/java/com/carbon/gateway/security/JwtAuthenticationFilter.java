package com.carbon.gateway.security;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.TraceIdHolder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final String TENANT_HEADER = "X-Tenant-Id";
    private static final String USER_ID_HEADER = "X-User-Id";
    private static final String TRACE_HEADER = "X-Trace-Id";

    private final SecretKey secretKey;
    private final List<String> whiteList;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public JwtAuthenticationFilter(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.whitelist:}") List<String> whiteList) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.whiteList = whiteList;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        ServerHttpResponse response = exchange.getResponse();

        String uri = request.getURI().getPath();
        String method = request.getMethod().name();

        String traceId = request.getHeaders().getFirst(TRACE_HEADER);
        if (traceId == null || traceId.isEmpty()) traceId = TraceIdHolder.get();
        final String finalTraceId = traceId;

        response.beforeCommit(() -> {
            response.getHeaders().add(TRACE_HEADER, finalTraceId);
            return Mono.empty();
        });

        if (isWhiteList(uri, method)) {
            ServerHttpRequest mutated = request.mutate()
                    .header(TRACE_HEADER, finalTraceId)
                    .build();
            return chain.filter(exchange.mutate().request(mutated).build());
        }

        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            return writeError(response, finalTraceId,
                    ErrorCode.UNAUTHORIZED.getCode(), "缺少 Authorization Bearer Token");
        }
        String token = auth.substring(7);
        Claims claims;
        try {
            claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException e) {
            ErrorCode code = e.getMessage() != null && e.getMessage().contains("expire")
                    ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID;
            return writeError(response, finalTraceId, code.getCode(), e.getMessage());
        }

        String tenantId = claims.get("tid", String.class);
        String userId = claims.get("uid", String.class);
        String username = claims.get("username", String.class);

        String headerTenant = request.getHeaders().getFirst(TENANT_HEADER);
        if (headerTenant != null && !headerTenant.isEmpty()
                && tenantId != null && !tenantId.equals(headerTenant)) {
            return writeError(response, finalTraceId,
                    ErrorCode.TENANT_MISMATCH.getCode(), "请求租户与Token租户不一致");
        }

        ServerHttpRequest mutated = request.mutate()
                .header(TENANT_HEADER, tenantId != null ? tenantId : "")
                .header(USER_ID_HEADER, userId != null ? userId : "")
                .header("X-Username", username != null ? username : "")
                .header(TRACE_HEADER, finalTraceId)
                .build();

        return chain.filter(exchange.mutate().request(mutated).build());
    }

    @Override
    public int getOrder() {
        return -100;
    }

    private boolean isWhiteList(String uri, String method) {
        for (String pattern : whiteList) {
            String[] parts = pattern.split(":", 2);
            if (parts.length == 2) {
                if (parts[0].equalsIgnoreCase(method) && pathMatcher.match(parts[1], uri)) return true;
            } else if (pathMatcher.match(pattern, uri)) {
                return true;
            }
        }
        return false;
    }

    private Mono<Void> writeError(ServerHttpResponse response, String traceId,
                                  Integer code, String message) {
        response.setStatusCode(HttpStatus.OK);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("message", message);
        body.put("traceId", traceId);
        body.put("timestamp", Instant.now().toString());
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(body);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            return response.setComplete();
        }
    }
}
