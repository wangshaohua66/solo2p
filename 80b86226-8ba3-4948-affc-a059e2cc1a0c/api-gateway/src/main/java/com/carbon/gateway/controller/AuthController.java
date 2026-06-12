package com.carbon.gateway.controller;

import com.carbon.common.api.R;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.security.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "认证", description = "登录/刷新Token/登出")
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping("/login")
    @Operation(summary = "登录获取Token", description = "开发环境模拟登录，生产对接SSO")
    public R<LoginResponse> login(@RequestBody LoginRequest request) {
        UserContextHolder.CurrentUser user = UserContextHolder.CurrentUser.builder()
                .userId(request.getUsername())
                .username(request.getUsername())
                .tenantId(request.getTenantId())
                .tenantName("示范租户-" + request.getTenantId())
                .organizationId("org-" + request.getTenantId())
                .roles(Set.of("ROLE_ADMIN", "ROLE_CARBON_MANAGER", "ROLE_VERIFIER"))
                .permissions(Set.of(
                        "emission:read", "emission:write",
                        "factor:read", "factor:write",
                        "calculation:read", "calculation:execute",
                        "quota:read", "quota:manage",
                        "ccer:read", "ccer:write",
                        "verification:read", "verification:sign",
                        "report:read", "report:generate"))
                .build();
        String token = jwtTokenProvider.createToken(user);
        return R.ok(LoginResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(86400)
                .user(user)
                .build());
    }

    @PostMapping("/refresh")
    @Operation(summary = "刷新Token")
    public R<LoginResponse> refresh(
            @Parameter(description = "原Token") @RequestHeader("Authorization") String auth) {
        String token = auth.substring(7);
        UserContextHolder.CurrentUser user = jwtTokenProvider.parseToken(token);
        return R.ok(LoginResponse.builder()
                .accessToken(jwtTokenProvider.createToken(user))
                .tokenType("Bearer")
                .expiresIn(86400)
                .build());
    }

    @GetMapping("/me")
    @Operation(summary = "当前用户信息")
    public R<UserContextHolder.CurrentUser> me() {
        UserContextHolder.CurrentUser user = UserContextHolder.CurrentUser.builder()
                .userId("carbon-admin")
                .username("carbon-admin")
                .tenantId("T001")
                .tenantName("示范钢铁集团")
                .build();
        return R.ok(user);
    }

    @PostMapping("/logout")
    @Operation(summary = "登出")
    public R<Void> logout() {
        return R.ok();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRequest {
        @Schema(description = "用户名", example = "carbon-manager")
        private String username;
        @Schema(description = "密码", example = "password")
        private String password;
        @Schema(description = "租户ID", example = "T001")
        private String tenantId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginResponse {
        @Schema(description = "访问令牌(JWT)")
        private String accessToken;
        @Schema(description = "令牌类型", example = "Bearer")
        private String tokenType;
        @Schema(description = "有效期(秒)")
        private Integer expiresIn;
        private UserContextHolder.CurrentUser user;
    }
}
