package com.carbon.gateway.handler;

import com.carbon.common.api.R;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.security.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@Tag(name = "认证", description = "登录/刷新Token/登出")
public class AuthHandler {

    private final JwtTokenProvider jwtTokenProvider;

    @Operation(summary = "登录获取Token", description = "开发环境模拟登录，生产对接SSO")
    public Mono<ServerResponse> login(ServerRequest request) {
        return request.bodyToMono(LoginRequest.class)
                .flatMap(req -> {
                    UserContextHolder.CurrentUser user = UserContextHolder.CurrentUser.builder()
                            .userId(req.getUsername())
                            .username(req.getUsername())
                            .tenantId(req.getTenantId())
                            .tenantName("示范租户-" + req.getTenantId())
                            .organizationId("org-" + req.getTenantId())
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
                    LoginResponse resp = LoginResponse.builder()
                            .accessToken(token)
                            .tokenType("Bearer")
                            .expiresIn(86400)
                            .user(user)
                            .build();
                    return ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(R.ok(resp));
                })
                .onErrorResume(e -> {
                    log.error("Login failed", e);
                    return ServerResponse.badRequest()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(R.fail(400, "登录失败: " + e.getMessage()));
                });
    }

    @Operation(summary = "刷新Token")
    public Mono<ServerResponse> refresh(ServerRequest request) {
        String auth = request.headers().firstHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ServerResponse.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(R.fail(401, "缺少Token"));
        }
        try {
            String token = auth.substring(7);
            UserContextHolder.CurrentUser user = jwtTokenProvider.parseToken(token);
            String newToken = jwtTokenProvider.createToken(user);
            LoginResponse resp = LoginResponse.builder()
                    .accessToken(newToken)
                    .tokenType("Bearer")
                    .expiresIn(86400)
                    .build();
            return ServerResponse.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(R.ok(resp));
        } catch (Exception e) {
            return ServerResponse.status(401)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(R.fail(401, "Token无效"));
        }
    }

    @Operation(summary = "当前用户信息")
    public Mono<ServerResponse> me(ServerRequest request) {
        String auth = request.headers().firstHeader("Authorization");
        UserContextHolder.CurrentUser user;
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                user = jwtTokenProvider.parseToken(auth.substring(7));
            } catch (Exception e) {
                user = buildDemoUser();
            }
        } else {
            user = buildDemoUser();
        }
        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(R.ok(user));
    }

    @Operation(summary = "登出")
    public Mono<ServerResponse> logout(ServerRequest request) {
        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(R.ok());
    }

    private UserContextHolder.CurrentUser buildDemoUser() {
        return UserContextHolder.CurrentUser.builder()
                .userId("carbon-admin")
                .username("carbon-admin")
                .tenantId("T001")
                .tenantName("示范钢铁集团")
                .roles(Set.of("ROLE_ADMIN"))
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "登录请求")
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
    @Schema(description = "登录响应")
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
