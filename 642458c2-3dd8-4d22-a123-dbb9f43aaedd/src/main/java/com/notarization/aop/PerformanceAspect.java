package com.notarization.aop;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Aspect
@Component
public class PerformanceAspect {

    @Value("${app.performance.threshold-ms:3000}")
    private long thresholdMs;

    @Pointcut("@within(org.springframework.web.bind.annotation.RestController)")
    public void restControllerPointcut() {
    }

    @Around("restControllerPointcut()")
    public Object monitorPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();

        try {
            Object result = joinPoint.proceed();
            return result;
        } finally {
            long elapsed = System.currentTimeMillis() - startTime;
            if (elapsed > thresholdMs) {
                log.warn("[性能告警] {}.{} 耗时 {}ms, 超过阈值 {}ms",
                        className, methodName, elapsed, thresholdMs);
            } else if (log.isDebugEnabled()) {
                log.debug("[性能监控] {}.{} 耗时 {}ms", className, methodName, elapsed);
            }
        }
    }
}
