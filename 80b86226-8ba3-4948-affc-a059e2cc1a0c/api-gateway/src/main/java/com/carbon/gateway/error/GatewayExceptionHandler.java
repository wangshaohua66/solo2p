package com.carbon.gateway.error;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.TraceIdHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@Order(-2)
public class GatewayExceptionHandler implements ErrorWebExceptionHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        ServerHttpResponse response = exchange.getResponse();
        if (response.isCommitted()) return Mono.error(ex);

        String traceId = TraceIdHolder.get();
        response.getHeaders().add("X-Trace-Id", traceId);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        Integer code = ErrorCode.INTERNAL_ERROR.getCode();
        String message = ex.getMessage();
        HttpStatus status = HttpStatus.OK;

        if (ex instanceof ResponseStatusException rse) {
            status = (HttpStatus) rse.getStatusCode();
            if (status == HttpStatus.TOO_MANY_REQUESTS) {
                code = ErrorCode.RATE_LIMIT_EXCEEDED.getCode();
                message = "请求过于频繁，请稍后再试";
            } else if (status == HttpStatus.UNAUTHORIZED) {
                code = ErrorCode.UNAUTHORIZED.getCode();
            } else if (status == HttpStatus.FORBIDDEN) {
                code = ErrorCode.FORBIDDEN.getCode();
            } else if (status == HttpStatus.NOT_FOUND) {
                code = ErrorCode.NOT_FOUND.getCode();
                message = "服务或路由不存在";
            } else if (status == HttpStatus.SERVICE_UNAVAILABLE) {
                code = ErrorCode.SERVICE_UNAVAILABLE.getCode();
                message = "下游服务暂不可用，请稍后再试";
            }
        } else if (ex.getMessage() != null && ex.getMessage().contains("429")) {
            code = ErrorCode.RATE_LIMIT_EXCEEDED.getCode();
            message = "请求过于频繁，请稍后再试";
        }

        if (code >= 50000) {
            log.error("[GatewayError] traceId={} status={} code={} message={}",
                    traceId, status, code, ex.getMessage(), ex);
        } else {
            log.warn("[GatewayError] traceId={} status={} code={} message={}",
                    traceId, status, code, ex.getMessage());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("message", message);
        body.put("traceId", traceId);
        body.put("timestamp", Instant.now().toString());

        try {
            byte[] bytes = objectMapper.writeValueAsBytes(body);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            response.setStatusCode(HttpStatus.OK);
            return response.writeWith(Mono.just(buffer));
        } catch (Exception e) {
            DataBuffer buffer = response.bufferFactory()
                    .wrap("{\"code\":50000,\"message\":\"internal error\"}".getBytes(StandardCharsets.UTF_8));
            return response.writeWith(Mono.just(buffer));
        }
    }
}
