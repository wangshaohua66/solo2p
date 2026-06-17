package com.heritage.auth.controller;

import com.heritage.auth.common.Result;
import com.heritage.auth.dto.LoginRequest;
import com.heritage.auth.dto.LoginResponse;
import com.heritage.auth.dto.RegisterRequest;
import com.heritage.auth.entity.User;
import com.heritage.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @PostMapping("/register")
    public Result<LoginResponse> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    @PostMapping("/refresh")
    public Result<LoginResponse> refreshToken(@RequestHeader("X-Refresh-Token") String refreshToken) {
        return Result.success(authService.refreshToken(refreshToken));
    }

    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader("Authorization") String token) {
        authService.logout(token.replace("Bearer ", ""));
        return Result.success(null);
    }

    @GetMapping("/me")
    public Result<User> getCurrentUser(HttpServletRequest request) {
        String userId = request.getHeader("X-User-Id");
        return Result.success(authService.getCurrentUser(userId));
    }
}
