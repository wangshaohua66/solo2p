package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_permission")
public class Permission extends BaseEntity {

    private String code;

    private String name;

    private String type;

    private String resource;

    private String action;

    private Long parentId;

    private Integer sortOrder;

    private Integer status;

    private String remark;
}
