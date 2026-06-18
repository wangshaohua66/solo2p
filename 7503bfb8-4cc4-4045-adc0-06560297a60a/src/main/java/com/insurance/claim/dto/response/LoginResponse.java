package com.insurance.claim.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "登录响应")
public class LoginResponse {

    @Schema(description = "访问令牌", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String token;

    @Schema(description = "令牌类型", example = "Bearer")
    private String tokenType;

    @Schema(description = "过期时间(秒)", example = "86400")
    private Long expiresIn;

    @Schema(description = "用户ID", example = "1")
    private Long userId;

    @Schema(description = "用户名", example = "admin")
    private String username;

    @Schema(description = "真实姓名", example = "管理员")
    private String realName;

    @Schema(description = "角色编码", example = "ROLE_ADMIN")
    private String role;

    @Schema(description = "角色名称", example = "系统管理员")
    private String roleName;

    @Schema(description = "所属机构编码", example = "BRANCH001")
    private String branchCode;

    @Schema(description = "所属机构名称", example = "北京分公司")
    private String branchName;

    @Schema(description = "权限列表")
    private List<String> permissions;

    @Schema(description = "登录时间")
    private LocalDateTime loginTime;
}
