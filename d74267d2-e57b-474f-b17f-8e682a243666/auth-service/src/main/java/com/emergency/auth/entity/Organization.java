package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.OrganizationLevel;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_organization")
public class Organization extends BaseEntity {

    private String code;

    private String name;

    private OrganizationLevel level;

    private Long parentId;

    private String parentPath;

    private String regionCode;

    private String leader;

    private String phone;

    private String address;

    private Integer sortOrder;

    private Integer status;

    private String remark;
}
