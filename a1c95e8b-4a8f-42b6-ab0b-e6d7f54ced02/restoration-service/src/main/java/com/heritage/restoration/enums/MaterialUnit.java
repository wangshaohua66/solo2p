package com.heritage.restoration.enums;

import lombok.Getter;

@Getter
public enum MaterialUnit {
    PIECE("件"),
    SET("套"),
    GRAM("克"),
    KILOGRAM("千克"),
    MILLILITER("毫升"),
    LITER("升"),
    METER("米"),
    SQUARE_METER("平方米"),
    HOUR("小时"),
    DAY("天"),
    OTHER("其他");

    private final String label;
    MaterialUnit(String label) { this.label = label; }
}
