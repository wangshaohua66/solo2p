package com.heritage.auth.enums;

import lombok.Getter;

@Getter
public enum RoleType {

    ADMIN("ADMIN", "系统管理员", "拥有系统全部权限"),
    EXPERT("EXPERT", "文物专家", "文物鉴定、协作、标注权限"),
    RESTORER("RESTORER", "修复师", "修复项目、修复记录权限"),
    ARCHIVIST("ARCHIVIST", "档案员", "文物档案管理权限"),
    INSPECTOR("INSPECTOR", "巡查员", "巡查任务、病害记录权限");

    private final String code;
    private final String name;
    private final String description;

    RoleType(String code, String name, String description) {
        this.code = code;
        this.name = name;
        this.description = description;
    }
}
