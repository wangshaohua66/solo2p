package com.notarization.security;

import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.NotarizationCase;
import com.notarization.model.User;
import com.notarization.model.enums.NotarizationType;
import com.notarization.repository.NotarizationRepository;
import com.notarization.repository.UserRepository;
import com.notarization.security.annotation.WillAccessRestricted;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.Optional;

@Aspect
@Component
public class WillAccessAspect {

    private final NotarizationRepository notarizationRepository;
    private final UserRepository userRepository;

    public WillAccessAspect(NotarizationRepository notarizationRepository, UserRepository userRepository) {
        this.notarizationRepository = notarizationRepository;
        this.userRepository = userRepository;
    }

    @Before("@annotation(WillAccessRestricted)")
    public void checkWillAccess(JoinPoint joinPoint) {
        String caseId = extractCaseId(joinPoint);
        if (caseId == null) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED, "无法获取案件ID");
        }

        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        if (NotarizationType.WILL.equals(notarizationCase.getCaseType())) {
            String currentUserId = getCurrentUserId();
            if (currentUserId == null) {
                throw new BusinessException(ErrorCode.UNAUTHORIZED);
            }

            if (notarizationCase.getAccessControl() == null
                    || notarizationCase.getAccessControl().getAllowedUserIds() == null
                    || !notarizationCase.getAccessControl().getAllowedUserIds().contains(currentUserId)) {
                throw new BusinessException(ErrorCode.ACCESS_DENIED, "无权访问该遗嘱类卷宗");
            }
        }
    }

    private String extractCaseId(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        for (int i = 0; i < parameters.length; i++) {
            Parameter param = parameters[i];
            if ("caseId".equals(param.getName()) && String.class.equals(param.getType())) {
                return (String) args[i];
            }
        }

        for (Object arg : args) {
            if (arg instanceof String) {
                Optional<NotarizationCase> caseOpt = notarizationRepository.findByCaseId((String) arg);
                if (caseOpt.isPresent()) {
                    return (String) arg;
                }
            }
        }

        return null;
    }

    private String getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails) {
            String username = ((UserDetails) principal).getUsername();
            Optional<User> userOpt = userRepository.findByUsername(username);
            return userOpt.map(User::getId).orElse(null);
        }
        return null;
    }
}
