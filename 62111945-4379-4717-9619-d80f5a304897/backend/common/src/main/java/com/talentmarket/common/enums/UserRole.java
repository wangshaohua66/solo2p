package com.talentmarket.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum UserRole {

    ADMIN("admin", "管理员"),
    ENTERPRISE("enterprise", "企业HR"),
    JOBSEEKER("jobseeker", "求职者");

    private final String code;
    private final String name;

    public static UserRole getByCode(String code) {
        for (UserRole role : values()) {
            if (role.getCode().equals(code)) {
                return role;
            }
        }
        return null;
    }
}
