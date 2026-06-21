package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum RoleEnum {

    SUPERVISOR("SUPERVISOR", "监察员"),
    INSPECTION_AGENCY("INSPECTION_AGENCY", "检验机构"),
    USE_UNIT("USE_UNIT", "使用单位"),
    ADMIN("ADMIN", "系统管理员");

    private final String code;
    private final String desc;

    RoleEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
