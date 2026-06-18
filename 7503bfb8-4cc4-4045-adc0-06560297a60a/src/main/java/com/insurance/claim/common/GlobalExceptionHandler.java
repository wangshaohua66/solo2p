package com.insurance.claim.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusinessException(BusinessException e, HttpServletRequest request) {
        log.warn("业务异常: {} - {}", request.getRequestURI(), e.getMessage());
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException e, HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.warn("参数校验异常: {} - {}", request.getRequestURI(), message);
        return ApiResponse.badRequest(message);
    }

    @ExceptionHandler(BindException.class)
    public ApiResponse<Void> handleBindException(BindException e, HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.warn("参数绑定异常: {} - {}", request.getRequestURI(), message);
        return ApiResponse.badRequest(message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ApiResponse<Void> handleConstraintViolationException(ConstraintViolationException e, HttpServletRequest request) {
        String message = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining(", "));
        log.warn("约束违反异常: {} - {}", request.getRequestURI(), message);
        return ApiResponse.badRequest(message);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ApiResponse<Void> handleBadCredentialsException(BadCredentialsException e, HttpServletRequest request) {
        log.warn("认证失败: {} - {}", request.getRequestURI(), e.getMessage());
        return ApiResponse.unauthorized("用户名或密码错误");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ApiResponse<Void> handleAuthenticationException(AuthenticationException e, HttpServletRequest request) {
        log.warn("认证异常: {} - {}", request.getRequestURI(), e.getMessage());
        return ApiResponse.unauthorized("认证失败，请重新登录");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ApiResponse<Void> handleAccessDeniedException(AccessDeniedException e, HttpServletRequest request) {
        log.warn("权限不足: {} - {}", request.getRequestURI(), e.getMessage());
        return ApiResponse.forbidden("权限不足，无法访问");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ApiResponse<Void> handleIllegalArgumentException(IllegalArgumentException e, HttpServletRequest request) {
        log.warn("非法参数: {} - {}", request.getRequestURI(), e.getMessage());
        return ApiResponse.badRequest(e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleException(Exception e, HttpServletRequest request) {
        log.error("系统异常: {}", request.getRequestURI(), e);
        return ApiResponse.error("系统内部错误，请稍后重试");
    }
}
