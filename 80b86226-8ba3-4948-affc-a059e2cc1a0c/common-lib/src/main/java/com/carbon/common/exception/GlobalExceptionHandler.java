package com.carbon.common.exception;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.R;
import com.carbon.common.api.TraceIdHolder;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleBusinessException(BusinessException e) {
        log.warn("[BizException] code={}, message={}, traceId={}",
                e.getCode(), e.getMessage(), TraceIdHolder.get());
        return R.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleValidationException(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("[ValidationException] message={}, traceId={}", msg, TraceIdHolder.get());
        return R.fail(ErrorCode.VALIDATION_FAILED, msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleConstraintViolationException(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("; "));
        log.warn("[ConstraintViolation] message={}, traceId={}", msg, TraceIdHolder.get());
        return R.fail(ErrorCode.VALIDATION_FAILED, msg);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleBindException(BindException e) {
        String msg = e.getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        log.warn("[BindException] message={}, traceId={}", msg, TraceIdHolder.get());
        return R.fail(ErrorCode.VALIDATION_FAILED, msg);
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class
    })
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleBadRequest(Exception e) {
        log.warn("[BadRequest] message={}, traceId={}", e.getMessage(), TraceIdHolder.get());
        return R.fail(ErrorCode.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(WebExchangeBindException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleWebExchangeBindException(WebExchangeBindException e) {
        String msg = e.getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("[WebValidation] message={}, traceId={}", msg, TraceIdHolder.get());
        return R.fail(ErrorCode.VALIDATION_FAILED, msg);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.OK)
    public R<Void> handleException(Exception e) {
        log.error("[InternalError] traceId={}", TraceIdHolder.get(), e);
        return R.fail(ErrorCode.INTERNAL_ERROR, e.getMessage());
    }
}
