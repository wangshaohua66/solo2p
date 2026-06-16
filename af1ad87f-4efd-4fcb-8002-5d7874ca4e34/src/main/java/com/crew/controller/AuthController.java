package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.dto.LoginRequest;
import com.crew.dto.LoginResponse;
import com.crew.entity.SysUser;
import com.crew.mapper.SysUserMapper;
import com.crew.security.JwtTokenProvider;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证管理", description = "登录认证接口")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final SysUserMapper sysUserMapper;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@RequestBody LoginRequest request) {
        SysUser user = sysUserMapper.selectOne(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, request.getUsername())
        );

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.AUTH_UNAUTHORIZED);
        }

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new BusinessException(ErrorCode.AUTH_UNAUTHORIZED);
        }

        String token = jwtTokenProvider.generateToken(user.getId(), user.getUsername(), user.getRole());

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUsername(user.getUsername());
        response.setRole(user.getRole());
        response.setRealName(user.getRealName());

        return ApiResponse.success(response);
    }

    @Operation(summary = "注册用户")
    @PostMapping("/register")
    public ApiResponse<Void> register(@RequestBody LoginRequest request) {
        long count = sysUserMapper.selectCount(
                new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, request.getUsername())
        );
        if (count > 0) {
            throw new BusinessException(ErrorCode.PARAM_INVALID.getCode(), "用户名已存在");
        }

        SysUser user = new SysUser();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("USER");
        user.setEnabled(true);
        sysUserMapper.insert(user);

        return ApiResponse.success();
    }
}
