package com.heritage.enums;

public enum HeritageCategory {
    TRADITIONAL_CRAFT("传统技艺"),
    TRADITIONAL_MUSIC("传统音乐"),
    TRADITIONAL_DANCE("传统舞蹈"),
    TRADITIONAL_OPERA("传统戏剧"),
    FOLK_CUSTOM("民俗");

    private final String displayName;

    HeritageCategory(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
