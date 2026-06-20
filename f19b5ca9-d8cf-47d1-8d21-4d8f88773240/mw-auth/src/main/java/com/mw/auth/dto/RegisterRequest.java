package com.mw.auth.dto;

import com.mw.common.validation.ValidationGroups;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class RegisterRequest {

    @NotBlank(message = "用户名不能为空", groups = ValidationGroups.Create.class)
    @Size(min = 3, max = 32, message = "用户名长度3-32位", groups = ValidationGroups.Create.class)
    private String username;

    @NotBlank(message = "密码不能为空", groups = ValidationGroups.Create.class)
    @Size(min = 6, max = 64, message = "密码长度6-64位", groups = ValidationGroups.Create.class)
    private String password;

    @NotBlank(message = "真实姓名不能为空", groups = ValidationGroups.Create.class)
    private String realName;

    @NotBlank(message = "机构编号不能为空", groups = ValidationGroups.Create.class)
    private String orgId;

    private String orgName;

    @NotNull(message = "角色不能为空", groups = ValidationGroups.Create.class)
    @Size(min = 1, message = "至少分配一个角色", groups = ValidationGroups.Create.class)
    private Set<@Pattern(regexp = "ROLE_(PRODUCER|TRANSPORTER|DISPOSER|REGULATOR|ADMIN)",
            message = "角色编码非法") String> roles;
}
