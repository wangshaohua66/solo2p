package com.heritage.artifact.enums;

import lombok.Getter;

@Getter
public enum ArtifactLevel {

    NATIONAL_LEVEL_1("NATIONAL_LEVEL_1", "国家一级文物"),
    NATIONAL_LEVEL_2("NATIONAL_LEVEL_2", "国家二级文物"),
    NATIONAL_LEVEL_3("NATIONAL_LEVEL_3", "国家三级文物"),
    GENERAL("GENERAL", "一般文物"),
    ORDINARY("ORDINARY", "普通文物");

    private final String code;
    private final String name;

    ArtifactLevel(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
