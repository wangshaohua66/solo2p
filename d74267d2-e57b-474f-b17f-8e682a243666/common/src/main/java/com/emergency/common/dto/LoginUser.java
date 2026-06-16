package com.emergency.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "当前登录用户信息")
public class LoginUser implements Serializable {

    @Schema(description = "用户ID")
    private Long userId;

    @Schema(description = "用户名")
    private String username;

    @Schema(description = "真实姓名")
    private String realName;

    @Schema(description = "手机号")
    private String phone;

    @Schema(description = "邮箱")
    private String email;

    @Schema(description = "所属组织ID")
    private Long organizationId;

    @Schema(description = "所属组织编码")
    private String organizationCode;

    @Schema(description = "所属组织名称")
    private String organizationName;

    @Schema(description = "组织层级:1-省级 2-市级 3-县级")
    private Integer organizationLevel;

    @Schema(description = "可访问的组织ID列表（数据权限）")
    private List<Long> accessibleOrgIds;

    @Schema(description = "行政区域编码")
    private String regionCode;

    @Schema(description = "角色编码列表")
    private Set<String> roles;

    @Schema(description = "权限编码列表")
    private Set<String> permissions;

    @Schema(description = "令牌过期时间")
    private Long expireTime;

    @Schema(description = "JWT令牌")
    private String token;
}
