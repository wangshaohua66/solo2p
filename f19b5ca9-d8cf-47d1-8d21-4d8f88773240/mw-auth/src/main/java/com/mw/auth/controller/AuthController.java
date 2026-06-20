package com.mw.auth.controller;

import com.mw.auth.dto.LoginRequest;
import com.mw.auth.dto.RefreshRequest;
import com.mw.auth.dto.RegisterRequest;
import com.mw.auth.dto.TokenResponse;
import com.mw.auth.service.AuthService;
import com.mw.common.response.ApiResponse;
import com.mw.common.validation.ValidationGroups;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "认证授权", description = "登录、注册、令牌刷新")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "账号密码登录，签发JWT")
    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }

    @Operation(summary = "注册机构账号（四类角色RBAC）")
    @PostMapping("/register")
    public ApiResponse<TokenResponse> register(
            @Validated(ValidationGroups.Create.class) @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));
    }

    @Operation(summary = "刷新访问令牌")
    @PostMapping("/refresh")
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.success(authService.refresh(request));
    }
}
