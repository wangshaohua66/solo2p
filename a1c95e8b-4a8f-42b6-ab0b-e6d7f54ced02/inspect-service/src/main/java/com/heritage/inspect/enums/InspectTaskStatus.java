package com.heritage.inspect.enums;

import lombok.Getter;

@Getter
public enum InspectTaskStatus {
    PENDING("PENDING", "待执行"),
    IN_PROGRESS("IN_PROGRESS", "执行中"),
    COMPLETED("COMPLETED", "已完成"),
    CANCELLED("CANCELLED", "已取消");

    private final String code;
    private final String name;

    InspectTaskStatus(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
