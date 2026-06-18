package com.insurance.claim.enums;

import lombok.Getter;

@Getter
public enum InsuranceType {

    VEHICLE(1, "车险", "机动车保险"),
    HOME(2, "家财险", "家庭财产保险"),
    ENTERPRISE(3, "企财险", "企业财产保险");

    private final Integer code;
    private final String name;
    private final String description;

    InsuranceType(Integer code, String name, String description) {
        this.code = code;
        this.name = name;
        this.description = description;
    }

    public static InsuranceType fromCode(Integer code) {
        for (InsuranceType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的险种: " + code);
    }
}
