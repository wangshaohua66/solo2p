package com.tobacco.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoleType {

    CITY_ADMIN(1, "ROLE_CITY_ADMIN", "市局管理员"),
    COUNTY_ADMIN(2, "ROLE_COUNTY_ADMIN", "县局管理员"),
    INSPECTOR(3, "ROLE_INSPECTOR", "稽查员"),
    AUDITOR(4, "ROLE_AUDITOR", "审核员"),
    RETAILER(5, "ROLE_RETAILER", "零售户");

    private final Integer code;
    private final String role;
    private final String name;

    public static RoleType getByCode(Integer code) {
        if (code == null) return null;
        for (RoleType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }

    public static RoleType getByRole(String role) {
        if (role == null) return null;
        for (RoleType type : values()) {
            if (type.getRole().equals(role)) {
                return type;
            }
        }
        return null;
    }
}
