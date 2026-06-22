package com.heritage.enums;

public enum UserRole {
    ADMIN("管理员"),
    STAFF("工作人员"),
    INHERITOR("传承人"),
    INSTITUTION("研学机构"),
    PUBLIC("社会公众");

    private final String displayName;

    UserRole(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
