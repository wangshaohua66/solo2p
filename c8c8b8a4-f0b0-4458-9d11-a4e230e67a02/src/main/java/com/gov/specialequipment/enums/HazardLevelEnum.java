package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum HazardLevelEnum {

    GENERAL(1, "一般隐患", 15),
    SERIOUS(2, "严重隐患", 7),
    MAJOR(3, "重大隐患", 3);

    private final Integer code;
    private final String desc;
    private final Integer deadlineDays;

    HazardLevelEnum(Integer code, String desc, Integer deadlineDays) {
        this.code = code;
        this.desc = desc;
        this.deadlineDays = deadlineDays;
    }

    public static HazardLevelEnum getByCode(Integer code) {
        if (code == null) return null;
        for (HazardLevelEnum e : values()) {
            if (e.getCode().equals(code)) return e;
        }
        return null;
    }
}
