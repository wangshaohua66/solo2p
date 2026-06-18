package com.insurance.claim.controller;

import com.insurance.claim.common.ApiResponse;
import com.insurance.claim.dto.request.LoginRequest;
import com.insurance.claim.dto.response.LoginResponse;
import com.insurance.claim.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "1-认证管理", description = "用户登录、注册、令牌管理")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "使用用户名和密码登录系统，获取JWT访问令牌")
    public ApiResponse<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        LoginResponse response = authService.login(request, clientIp);
        return ApiResponse.success("登录成功", response);
    }

    @PostMapping("/logout")
    @Operation(summary = "用户登出", description = "退出当前登录，清除安全上下文")
    public ApiResponse<Void> logout(
            @Parameter(description = "认证令牌") @RequestHeader(value = "Authorization", required = false) String token) {
        authService.logout(token);
        return ApiResponse.success("登出成功", null);
    }

    @PostMapping("/refresh-token")
    @Operation(summary = "刷新令牌", description = "使用旧令牌换取新令牌，延长有效期")
    public ApiResponse<String> refreshToken(
            @Parameter(description = "认证令牌") @RequestHeader("Authorization") String token) {
        String newToken = authService.refreshToken(token);
        return ApiResponse.success("令牌刷新成功", newToken);
    }

    @GetMapping("/validate")
    @Operation(summary = "验证令牌", description = "验证当前令牌是否有效")
    public ApiResponse<Boolean> validateToken(
            @Parameter(description = "认证令牌") @RequestHeader("Authorization") String token) {
        boolean valid = authService.validateToken(token);
        return ApiResponse.success(valid);
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
}
