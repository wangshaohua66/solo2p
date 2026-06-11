package com.glassstudio.aspect;

import com.glassstudio.annotation.RateLimit;
import com.glassstudio.exception.BusinessException;
import com.glassstudio.service.RateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;

@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RateLimiterService rateLimiterService;

    @Around("@annotation(com.glassstudio.annotation.RateLimit)")
    public Object rateLimit(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        RateLimit rateLimit = method.getAnnotation(RateLimit.class);

        String key = resolveKey(rateLimit, method);
        int limit = rateLimit.limit();
        int window = rateLimit.window();

        boolean allowed = rateLimiterService.tryAcquire(key, limit, window);
        if (!allowed) {
            throw new BusinessException("请求过于频繁，请稍后再试", HttpStatus.TOO_MANY_REQUESTS);
        }

        return joinPoint.proceed();
    }

    private String resolveKey(RateLimit rateLimit, Method method) {
        String key = rateLimit.key();
        if (key.isEmpty()) {
            key = method.getDeclaringClass().getSimpleName() + "." + method.getName();
        }

        if (key.contains("{ip}")) {
            String ip = getClientIp();
            key = key.replace("{ip}", ip);
        }

        if (key.contains("{user}")) {
            String user = getCurrentUser();
            key = key.replace("{user}", user);
        }

        return key;
    }

    private String getClientIp() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                return xForwardedFor.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        }
        return "unknown";
    }

    private String getCurrentUser() {
        try {
            org.springframework.security.core.Authentication authentication =
                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()
                    && !"anonymousUser".equals(authentication.getPrincipal())) {
                return authentication.getName();
            }
        } catch (Exception ignored) {
        }
        return "anonymous";
    }
}
