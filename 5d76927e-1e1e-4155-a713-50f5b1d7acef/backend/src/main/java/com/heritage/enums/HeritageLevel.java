package com.heritage.enums;

public enum HeritageLevel {
    NATIONAL("国家级"),
    PROVINCIAL("省级"),
    MUNICIPAL("市级");

    private final String displayName;

    HeritageLevel(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
