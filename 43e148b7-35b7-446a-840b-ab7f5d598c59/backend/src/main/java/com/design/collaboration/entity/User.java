package com.design.collaboration.entity;

import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.UserRole;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "用户")
public class User {

    @Schema(description = "用户ID")
    private Long id;

    @Schema(description = "用户名")
    private String username;

    @JsonIgnore
    @Schema(description = "密码，不返回给前端")
    private String password;

    @Schema(description = "姓名")
    private String name;

    @Schema(description = "角色")
    private UserRole role;

    @Schema(description = "邮箱")
    private String email;

    @Schema(description = "电话")
    private String phone;

    @Schema(description = "专业")
    private ProfessionType profession;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "登录Token")
    private transient String token;
}
