package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role")
public class Role extends BaseEntity {

    private String code;

    private String name;

    private String description;

    private Integer dataScope;

    private Integer sortOrder;

    private Integer status;

    private String remark;
}
