package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum IncidentLevel {

    LEVEL_IV(4, "一般", "蓝色", 4),
    LEVEL_III(3, "较大", "黄色", 3),
    LEVEL_II(2, "重大", "橙色", 2),
    LEVEL_I(1, "特别重大", "红色", 1);

    private final int level;
    private final String name;
    private final String color;
    private final int priority;

    public static IncidentLevel fromLevel(int level) {
        for (IncidentLevel il : values()) {
            if (il.level == level) {
                return il;
            }
        }
        return LEVEL_IV;
    }

    public boolean isHigherOrEqual(IncidentLevel other) {
        return this.priority <= other.priority;
    }
}
