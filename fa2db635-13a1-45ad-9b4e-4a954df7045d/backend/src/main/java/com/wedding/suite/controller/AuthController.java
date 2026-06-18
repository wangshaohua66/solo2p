package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.LoginRequest;
import com.wedding.suite.dto.request.SupplierLoginRequest;
import com.wedding.suite.dto.response.LoginVO;
import com.wedding.suite.dto.response.SupplierLoginVO;
import com.wedding.suite.service.impl.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginVO> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/supplier/login")
    public ApiResponse<SupplierLoginVO> supplierLogin(@Valid @RequestBody SupplierLoginRequest req) {
        return ApiResponse.ok(authService.supplierLogin(req));
    }
}
