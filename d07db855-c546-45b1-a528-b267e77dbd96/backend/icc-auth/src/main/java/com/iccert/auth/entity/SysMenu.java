package com.iccert.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_menu")
public class SysMenu extends BaseEntity {
    private Long parentId;
    private String menuName;
    private String menuPath;
    private String menuIcon;
    private String component;
    private String permission;
    private Integer menuType;
    private Integer sort;
    private Integer visible;
    private Integer status;
}
