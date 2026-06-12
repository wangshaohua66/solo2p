package com.carbon.common.audit;

import com.carbon.common.api.TraceIdHolder;
import com.carbon.common.context.UserContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final MongoTemplate mongoTemplate;
    private final ObjectMapper objectMapper;

    @Around("@annotation(auditLog)")
    public Object around(ProceedingJoinPoint pjp, AuditLog auditLog) throws Throwable {
        long start = System.currentTimeMillis();
        Object result;
        Throwable throwable = null;
        try {
            result = pjp.proceed();
            return result;
        } catch (Throwable t) {
            throwable = t;
            throw t;
        } finally {
            try {
                long duration = System.currentTimeMillis() - start;
                recordAudit(pjp, auditLog, duration, throwable);
            } catch (Exception e) {
                log.error("Audit log write failed", e);
            }
        }
    }

    @Async
    public void recordAudit(ProceedingJoinPoint pjp, AuditLog auditLog,
                            long duration, Throwable throwable) {
        HttpServletRequest req = resolveRequest();
        UserContextHolder.CurrentUser user = UserContextHolder.getNullable();

        MethodSignature sig = (MethodSignature) pjp.getSignature();
        String[] paramNames = sig.getParameterNames();
        Object[] args = pjp.getArgs();

        Map<String, Object> requestSnapshot = null;
        if (auditLog.recordRequest()) {
            Set<String> mask = Arrays.stream(auditLog.maskFields()).collect(Collectors.toSet());
            requestSnapshot = new HashMap<>();
            for (int i = 0; i < paramNames.length; i++) {
                Object val = args[i];
                requestSnapshot.put(paramNames[i], mask.contains(paramNames[i]) ? "***" : val);
            }
        }

        Map<String, Object> responseSnapshot = null;
        if (auditLog.recordResponse()) {
            responseSnapshot = new HashMap<>();
        }

        String resourceId = extractResourceId(args);

        AuditLogRecord record = AuditLogRecord.builder()
                .tenantId(user != null ? user.getTenantId() : null)
                .traceId(TraceIdHolder.get())
                .userId(user != null ? user.getUserId() : null)
                .username(user != null ? user.getUsername() : null)
                .organizationId(user != null ? user.getOrganizationId() : null)
                .module(auditLog.module().isEmpty() ? sig.getDeclaringType().getSimpleName() : auditLog.module())
                .operation(auditLog.operation())
                .resourceType(auditLog.resourceType())
                .resourceId(resourceId)
                .method(req != null ? req.getMethod() : null)
                .uri(req != null ? req.getRequestURI() : null)
                .clientIp(req != null ? resolveIp(req) : null)
                .userAgent(req != null ? req.getHeader("User-Agent") : null)
                .durationMs((double) duration)
                .success(throwable == null)
                .errorMessage(throwable != null ? throwable.getMessage() : null)
                .requestSnapshot(requestSnapshot)
                .responseSnapshot(responseSnapshot)
                .expireAt(Instant.now().plus(365, ChronoUnit.DAYS))
                .createdAt(Instant.now())
                .build();

        try {
            mongoTemplate.save(record);
        } catch (Exception e) {
            log.warn("Audit log persist failed: {}", e.getMessage());
        }
    }

    private HttpServletRequest resolveRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) return xff.split(",")[0].trim();
        String real = req.getHeader("X-Real-IP");
        return real != null && !real.isEmpty() ? real : req.getRemoteAddr();
    }

    private String extractResourceId(Object[] args) {
        for (Object a : args) {
            if (a instanceof String s && s.length() > 4 && s.length() < 64) return s;
        }
        return null;
    }
}
