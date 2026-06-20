package com.mw.common.audit;

import cn.hutool.json.JSONUtil;
import com.mw.common.security.UserContext;
import com.mw.common.security.UserInfo;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.time.LocalDateTime;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final MongoTemplate mongoTemplate;

    @Around("@annotation(auditable)")
    public Object around(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        Object result = pjp.proceed();
        try {
            recordAudit(pjp, auditable, result);
        } catch (Exception e) {
            log.warn("记录审计日志失败: {}", e.getMessage());
        }
        return result;
    }

    private void recordAudit(ProceedingJoinPoint pjp, Auditable auditable, Object result) {
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        Method method = signature.getMethod();

        AuditLog auditLog = new AuditLog();
        UserInfo user = UserContext.get();
        if (user != null) {
            auditLog.setOperatorId(user.getUserId());
            auditLog.setOperatorName(user.getUsername());
            auditLog.setOrgId(user.getOrgId());
        } else {
            auditLog.setOperatorId("system");
            auditLog.setOperatorName("system");
        }
        auditLog.setAction(auditable.action().name());
        auditLog.setModule(auditable.module());
        auditLog.setDescription(auditable.description());
        auditLog.setBeforeData(JSONUtil.toJsonStr(pjp.getArgs()));
        if (auditable.recordResult() && result != null) {
            auditLog.setAfterData(JSONUtil.toJsonStr(result));
        }
        auditLog.setBusinessKey(extractBusinessKey(pjp.getArgs()));
        auditLog.setOperateTime(LocalDateTime.now());

        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            auditLog.setIp(request.getRemoteAddr());
            auditLog.setRequestUri(request.getRequestURI());
        }

        mongoTemplate.save(auditLog);
        log.debug("审计日志已记录: operator={}, action={}, key={}",
                auditLog.getOperatorId(), auditLog.getAction(), auditLog.getBusinessKey());
    }

    private String extractBusinessKey(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }
}
