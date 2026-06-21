package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum AccidentLevelEnum {

    GENERAL(1, "一般事故"),
    LARGER(2, "较大事故"),
    MAJOR(3, "重大事故"),
    ESPECIALLY_MAJOR(4, "特别重大事故");

    private final Integer code;
    private final String desc;

    AccidentLevelEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
