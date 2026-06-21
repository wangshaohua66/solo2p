package com.gov.specialequipment.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gov.specialequipment.util.SecurityUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.time.LocalDateTime;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    @Around("@annotation(com.gov.specialequipment.annotation.AuditLog)")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        com.gov.specialequipment.annotation.AuditLog auditLogAnnotation =
                method.getAnnotation(com.gov.specialequipment.annotation.AuditLog.class);

        com.gov.specialequipment.entity.AuditLog auditLog = new com.gov.specialequipment.entity.AuditLog();
        auditLog.setOperationModule(auditLogAnnotation.module());
        auditLog.setOperationType(auditLogAnnotation.operationType());
        auditLog.setOperationDesc(auditLogAnnotation.description());
        auditLog.setOperateTime(LocalDateTime.now());

        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            auditLog.setRequestIp(getClientIp(request));
            auditLog.setRequestMethod(request.getMethod());
            auditLog.setRequestUrl(request.getRequestURI());

            try {
                Object[] args = joinPoint.getArgs();
                if (args != null && args.length > 0) {
                    StringBuilder params = new StringBuilder();
                    for (Object arg : args) {
                        if (arg != null && !isRequestResponse(arg)) {
                            params.append(objectMapper.writeValueAsString(arg)).append(";");
                        }
                    }
                    if (params.length() > 2000) {
                        auditLog.setRequestParam(params.substring(0, 2000));
                    } else {
                        auditLog.setRequestParam(params.toString());
                    }
                }
            } catch (Exception e) {
                log.warn("获取请求参数失败", e);
            }
        }

        auditLog.setOperatorId(SecurityUtil.getCurrentUserId());
        auditLog.setOperatorName(SecurityUtil.getCurrentRealName());
        auditLog.setOperatorRole(SecurityUtil.getCurrentRoleCode());

        Object result;
        try {
            result = joinPoint.proceed();
            auditLog.setResultStatus(1);
            auditLog.setResultMessage("操作成功");
        } catch (Throwable e) {
            auditLog.setResultStatus(0);
            auditLog.setResultMessage(e.getMessage() != null ? e.getMessage().substring(0, Math.min(500, e.getMessage().length())) : "操作失败");
            long costTime = System.currentTimeMillis() - startTime;
            auditLog.setCostTime(costTime);
            saveAuditLog(auditLog);
            throw e;
        }

        long costTime = System.currentTimeMillis() - startTime;
        auditLog.setCostTime(costTime);
        saveAuditLog(auditLog);

        return result;
    }

    @Async
    public void saveAuditLog(com.gov.specialequipment.entity.AuditLog auditLog) {
        try {
            auditLogMapper.insert(auditLog);
        } catch (Exception e) {
            log.error("保存审计日志失败", e);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_CLIENT_IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    private boolean isRequestResponse(Object obj) {
        return obj instanceof jakarta.servlet.ServletRequest
                || obj instanceof jakarta.servlet.ServletResponse;
    }
}
