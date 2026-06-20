package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.dto.request.LoginRequest;
import com.notarization.model.User;
import com.notarization.security.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@Validated
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody @Valid LoginRequest request) {
        Map<String, Object> result = authService.login(request);
        return ApiResponse.success(result);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String token = null;
        if (authorization != null && authorization.startsWith("Bearer ")) {
            token = authorization.substring(7);
        }
        authService.logout(token);
        return ApiResponse.success(null);
    }

    @GetMapping("/me")
    public ApiResponse<User> getCurrentUser() {
        User user = authService.getCurrentUser();
        return ApiResponse.success(user);
    }
}
