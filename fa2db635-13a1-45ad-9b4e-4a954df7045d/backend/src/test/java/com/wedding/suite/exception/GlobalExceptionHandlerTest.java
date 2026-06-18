package com.wedding.suite.exception;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.ContractSignRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("GlobalExceptionHandler 异常分支覆盖测试")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("MethodArgumentNotValidException → code=422 + 字段错误")
    void handleValidation_returns422WithFieldErrors() {
        ContractSignRequest target = new ContractSignRequest();
        BeanPropertyBindingResult br = new BeanPropertyBindingResult(target, "contractSignRequest");
        br.addError(new FieldError("contractSignRequest", "signer", "签署人姓名不能为空"));
        br.addError(new FieldError("contractSignRequest", "signerPhone", "签署人手机号格式不正确"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, br);

        ResponseEntity<ApiResponse<java.util.Map<String, String>>> resp = handler.handleValidation(ex);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(422, resp.getBody().getCode());
        assertEquals("签署人姓名不能为空", resp.getBody().getData().get("signer"));
        assertEquals("签署人手机号格式不正确", resp.getBody().getData().get("signerPhone"));
    }

    @Test
    @DisplayName("ConstraintViolationException → code=422 + 错误字段")
    void handleConstraint_returns422WithViolations() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        ContractSignRequest req = new ContractSignRequest();
        Set<ConstraintViolation<ContractSignRequest>> vs = validator.validate(req);
        ConstraintViolationException ex = new ConstraintViolationException("校验失败", (Set) vs);

        ResponseEntity<ApiResponse<java.util.Map<String, String>>> resp = handler.handleConstraint(ex);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals(422, resp.getBody().getCode());
        assertFalse(resp.getBody().getData().isEmpty());
    }

    @Test
    @DisplayName("MethodArgumentTypeMismatchException → code=400")
    void handleTypeMismatch_returns400() {
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "abc", Long.class, "id", null, new NumberFormatException("For input: abc"));

        ResponseEntity<ApiResponse<Void>> resp = handler.handleTypeMismatch(ex);
        assertEquals(400, resp.getBody().getCode());
        assertTrue(resp.getBody().getMessage().contains("id"));
    }

    @Test
    @DisplayName("BusinessException → 对应错误码和消息")
    void handleBusiness_returnsErrorCode() {
        BusinessException ex = new BusinessException(ErrorCode.NOT_FOUND, "合同不存在");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleBusiness(ex);
        assertEquals(404, resp.getBody().getCode());
        assertEquals("合同不存在", resp.getBody().getMessage());
    }

    @Test
    @DisplayName("AuthenticationException → code=401 认证失败")
    void handleAuth_returns401() {
        AuthenticationException ex = new AuthenticationException("令牌已过期") {};

        ResponseEntity<ApiResponse<Void>> resp = handler.handleAuth(ex);
        assertEquals(401, resp.getBody().getCode());
        assertTrue(resp.getBody().getMessage().contains("认证失败"));
    }

    @Test
    @DisplayName("AccessDeniedException → code=403 无权限")
    void handleAccess_returns403() {
        AccessDeniedException ex = new AccessDeniedException("拒绝访问");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleAccess(ex);
        assertEquals(403, resp.getBody().getCode());
        assertEquals("无权限访问", resp.getBody().getMessage());
    }

    @Test
    @DisplayName("Exception (兜底) → HTTP 500")
    void handleAll_returns500() {
        Exception ex = new RuntimeException("未知错误");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleAll(ex);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, resp.getStatusCode());
        assertEquals(500, resp.getBody().getCode());
        assertEquals("服务器内部错误", resp.getBody().getMessage());
    }
}
