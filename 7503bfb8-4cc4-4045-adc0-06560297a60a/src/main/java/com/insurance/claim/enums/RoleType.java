package com.insurance.claim.enums;

import lombok.Getter;

@Getter
public enum RoleType {

    ADMIN(1, "ROLE_ADMIN", "系统管理员"),
    CLAIM_REPORTER(2, "ROLE_REPORTER", "报案人"),
    SURVEYOR(3, "ROLE_SURVEYOR", "查勘员"),
    ASSESSOR(4, "ROLE_ASSESSOR", "定损员"),
    REVIEWER(5, "ROLE_REVIEWER", "核赔师"),
    FINANCE(6, "ROLE_FINANCE", "财务专员"),
    FRAUD_INVESTIGATOR(7, "ROLE_FRAUD_INVESTIGATOR", "欺诈调查员");

    private final Integer code;
    private final String authority;
    private final String description;

    RoleType(Integer code, String authority, String description) {
        this.code = code;
        this.authority = authority;
        this.description = description;
    }

    public static RoleType fromCode(Integer code) {
        for (RoleType role : values()) {
            if (role.getCode().equals(code)) {
                return role;
            }
        }
        throw new IllegalArgumentException("未知的角色类型: " + code);
    }

    public static RoleType fromAuthority(String authority) {
        for (RoleType role : values()) {
            if (role.getAuthority().equals(authority)) {
                return role;
            }
        }
        throw new IllegalArgumentException("未知的权限标识: " + authority);
    }
}
