package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum OrganizationLevel {

    PROVINCE("省级", 1),
    CITY("市级", 2),
    COUNTY("县级", 3);

    private final String description;
    private final int code;

    public static OrganizationLevel fromCode(int code) {
        for (OrganizationLevel level : values()) {
            if (level.code == code) {
                return level;
            }
        }
        return COUNTY;
    }
}
