package com.heritage.inspect.enums;

import lombok.Getter;

@Getter
public enum AlertLevel {
    LOW("LOW", "低"),
    MEDIUM("MEDIUM", "中"),
    HIGH("HIGH", "高"),
    CRITICAL("CRITICAL", "紧急");

    private final String code;
    private final String name;

    AlertLevel(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
