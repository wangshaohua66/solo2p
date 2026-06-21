package com.gov.specialequipment.controller;

import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.dto.LoginDTO;
import com.gov.specialequipment.service.AuthService;
import com.gov.specialequipment.vo.LoginVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证授权")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(authService.login(dto));
    }

    @Operation(summary = "用户登出")
    @PostMapping("/logout")
    public Result<Void> logout() {
        return Result.success();
    }
}
