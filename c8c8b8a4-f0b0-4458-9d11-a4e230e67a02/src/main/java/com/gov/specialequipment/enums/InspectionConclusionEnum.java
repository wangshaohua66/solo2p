package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum InspectionConclusionEnum {

    QUALIFIED(1, "合格"),
    RECTIFICATION(2, "整改后复检"),
    DISQUALIFIED(3, "不合格停用");

    private final Integer code;
    private final String desc;

    InspectionConclusionEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
