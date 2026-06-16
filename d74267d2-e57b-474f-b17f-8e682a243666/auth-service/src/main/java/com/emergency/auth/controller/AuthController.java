package com.emergency.auth.controller;

import com.emergency.auth.dto.LoginRequest;
import com.emergency.auth.dto.LoginResponse;
import com.emergency.auth.service.AuthService;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Tag(name = "认证接口", description = "用户登录、登出、令牌刷新")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "用户名密码登录，返回访问令牌和刷新令牌")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @PostMapping("/logout")
    @Operation(summary = "用户登出", description = "使当前令牌失效")
    public Result<Void> logout(@Parameter(hidden = true) @RequestHeader(value = "Authorization", required = false) String token) {
        authService.logout(token);
        return Result.success();
    }

    @PostMapping("/refresh-token")
    @Operation(summary = "刷新令牌", description = "使用刷新令牌获取新的访问令牌")
    public Result<LoginResponse> refreshToken(@RequestBody String refreshToken) {
        return Result.success(authService.refreshToken(refreshToken));
    }

    @GetMapping("/userinfo")
    @Operation(summary = "获取当前用户信息", description = "获取当前登录用户的详细信息")
    public Result<LoginUser> getUserInfo() {
        return Result.success(authService.buildLoginUser(authService.getCurrentUser()));
    }
}
