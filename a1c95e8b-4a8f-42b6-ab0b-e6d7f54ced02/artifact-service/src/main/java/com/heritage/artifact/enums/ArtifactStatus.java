package com.heritage.artifact.enums;

import lombok.Getter;

@Getter
public enum ArtifactStatus {

    IN_STORAGE("IN_STORAGE", "在库"),
    ON_DISPLAY("ON_DISPLAY", "展出"),
    IN_REPAIR("IN_REPAIR", "修复中"),
    ON_LOAN("ON_LOAN", "外借"),
    LOST("LOST", "遗失"),
    DAMAGED("DAMAGED", "损坏");

    private final String code;
    private final String name;

    ArtifactStatus(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
