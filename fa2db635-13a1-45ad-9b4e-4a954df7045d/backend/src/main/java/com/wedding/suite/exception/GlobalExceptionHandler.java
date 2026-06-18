package com.wedding.suite.exception;

import com.wedding.suite.dto.ApiResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        java.util.Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, fe -> fe.getDefaultMessage() == null ? "invalid" : fe.getDefaultMessage(), (a, b) -> a));
        log.warn("validation failed: {}", errors);
        ApiResponse<java.util.Map<String, String>> resp = ApiResponse.fail(ErrorCode.VALIDATION_ERROR.code(), "参数校验失败");
        resp.setData(errors);
        return ResponseEntity.status(HttpStatus.OK).body(resp);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> handleConstraint(ConstraintViolationException ex) {
        java.util.Map<String, String> errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage, (a, b) -> a));
        log.warn("constraint violation: {}", errors);
        ApiResponse<java.util.Map<String, String>> resp = ApiResponse.fail(ErrorCode.VALIDATION_ERROR.code(), "参数校验失败");
        resp.setData(errors);
        return ResponseEntity.status(HttpStatus.OK).body(resp);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.ok(ApiResponse.fail(ErrorCode.BAD_REQUEST.code(), "参数类型错误: " + ex.getName()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        log.warn("business error: {} {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.ok(ApiResponse.fail(ex.getErrorCode().code(), ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuth(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.OK)
                .body(ApiResponse.fail(ErrorCode.UNAUTHORIZED.code(), "认证失败: " + ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccess(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.OK)
                .body(ApiResponse.fail(ErrorCode.FORBIDDEN.code(), "无权限访问"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleAll(Exception ex) {
        log.error("unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(500, "服务器内部错误"));
    }
}
