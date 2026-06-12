package com.carbon.common.web;

import com.carbon.common.api.TraceIdHolder;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Order(Ordered.HIGHEST_PRECEDENCE)
public class ReactiveTraceIdFilter implements WebFilter {

    public static final String HEADER_TRACE_ID = "X-Trace-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String traceId = exchange.getRequest().getHeaders().getFirst(HEADER_TRACE_ID);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        final String finalTraceId = traceId;
        TraceIdHolder.set(finalTraceId);
        exchange.getResponse().getHeaders().set(HEADER_TRACE_ID, finalTraceId);

        return chain.filter(exchange)
                .contextWrite(ctx -> ctx.put("traceId", finalTraceId))
                .doFinally(signalType -> TraceIdHolder.clear());
    }
}
