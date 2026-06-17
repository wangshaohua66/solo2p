package com.heritage.restoration.enums;

import lombok.Getter;

@Getter
public enum RepairType {
    CLEANING("清洗除尘"),
    DESALINATION("脱盐处理"),
    REINFORCEMENT("加固修复"),
    RESTORATION("原貌修复"),
    RECOMBINATION("拼接复原"),
    COLORING("补色修复"),
    FRAMING("装裱装帧"),
    ANTISEPSIS("防腐防虫"),
    CONSOLIDATION("结构加固"),
    OTHER("其他");

    private final String label;
    RepairType(String label) { this.label = label; }
}
