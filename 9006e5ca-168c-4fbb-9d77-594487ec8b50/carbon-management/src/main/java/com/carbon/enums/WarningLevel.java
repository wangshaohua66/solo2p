package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum WarningLevel {
    NORMAL("NORMAL", "正常"),
    WARNING("WARNING", "预警(80%)"),
    ALERT("ALERT", "告警(90%)");

    private final String code;
    private final String desc;
}
