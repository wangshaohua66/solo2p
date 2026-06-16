package com.carbon.common.aspect;

import com.carbon.entity.AuditLog;
import com.carbon.service.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Pointcut("execution(* com.carbon.controller.*Controller.*(..))")
    public void controllerPointcut() {}

    @Around("controllerPointcut()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getDeclaringTypeName() + "." + joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();

        Object result = joinPoint.proceed();

        if (isWriteOperation(methodName)) {
            try {
                AuditLog auditLog = new AuditLog();
                auditLog.setBizType(extractBizType(methodName));
                auditLog.setOperation(methodName);
                auditLog.setOperator(getCurrentOperator());
                auditLog.setAfterSnapshot(objectMapper.writeValueAsString(args));
                auditLog.setCreatedTime(LocalDateTime.now());
                auditService.log(auditLog);
            } catch (Exception e) {
                log.error("AOP审计日志写入失败", e);
            }
        }

        return result;
    }

    private boolean isWriteOperation(String methodName) {
        return methodName.contains("allocate") || methodName.contains("issue")
                || methodName.contains("adjust") || methodName.contains("report")
                || methodName.contains("verify") || methodName.contains("createListing")
                || methodName.contains("createAgreement") || methodName.contains("matchOrder")
                || methodName.contains("cancelOrder") || methodName.contains("clear")
                || methodName.contains("applyInstallment") || methodName.contains("batchImport");
    }

    private String extractBizType(String methodName) {
        if (methodName.contains("QuotaController")) return "QUOTA_OPERATION";
        if (methodName.contains("EmissionController")) return "EMISSION_OPERATION";
        if (methodName.contains("TradeController")) return "TRADE_OPERATION";
        if (methodName.contains("SettlementController")) return "SETTLEMENT_OPERATION";
        return "SYSTEM_OPERATION";
    }

    private String getCurrentOperator() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String operator = request.getHeader("X-Operator");
            if (operator != null) {
                return operator;
            }
        }
        return "SYSTEM";
    }
}
