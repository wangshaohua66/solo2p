package com.carbon.common.web;

import com.carbon.common.api.TraceIdHolder;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.exception.UnauthorizedException;
import com.carbon.common.security.JwtTokenProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.util.Pair;
import org.springframework.http.HttpHeaders;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
public class TenantContextFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-Id";
    private static final String TRACE_HEADER = "X-Trace-Id";
    private final JwtTokenProvider jwtTokenProvider;
    private final List<String> whiteList;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String uri = request.getRequestURI();
            String traceId = request.getHeader(TRACE_HEADER);
            if (traceId == null || traceId.isEmpty()) traceId = TraceIdHolder.get();
            else TraceIdHolder.set(traceId);
            response.setHeader(TRACE_HEADER, traceId);

            if (isWhiteList(uri, request.getMethod())) {
                filterChain.doFilter(request, response);
                return;
            }

            String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (auth == null || !auth.startsWith("Bearer ")) {
                throw new UnauthorizedException("缺少 Authorization Bearer Token");
            }
            String token = auth.substring(7);
            UserContextHolder.CurrentUser user = jwtTokenProvider.parseToken(token);

            String headerTenant = request.getHeader(TENANT_HEADER);
            if (headerTenant != null && !headerTenant.isEmpty()
                    && user.getTenantId() != null && !user.getTenantId().equals(headerTenant)) {
                throw new com.carbon.common.exception.BusinessException(
                        com.carbon.common.api.ErrorCode.TENANT_MISMATCH,
                        "请求租户与Token租户不一致");
            }

            UserContextHolder.set(user);
            filterChain.doFilter(request, response);
        } finally {
            TraceIdHolder.clear();
            UserContextHolder.clear();
        }
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
}
