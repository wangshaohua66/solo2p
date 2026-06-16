package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class User extends BaseEntity {

    private String username;

    private String password;

    private String realName;

    private String phone;

    private String email;

    private String avatar;

    private Long organizationId;

    private String regionCode;

    private Integer status;

    private Integer loginFailCount;

    private LocalDateTime lastLoginTime;

    private String lastLoginIp;

    private LocalDateTime lockExpireTime;

    @TableField(exist = false)
    private Set<Long> roleIds;

    @TableField(exist = false)
    private Set<String> roleCodes;

    @TableField(exist = false)
    private Set<String> permissions;

    public boolean isAccountLocked() {
        return lockExpireTime != null && lockExpireTime.isAfter(LocalDateTime.now());
    }

    public boolean isEnabled() {
        return status != null && status == 1;
    }
}
