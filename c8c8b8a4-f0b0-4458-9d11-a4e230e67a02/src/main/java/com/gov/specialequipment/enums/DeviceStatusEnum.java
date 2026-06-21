package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum DeviceStatusEnum {

    NORMAL(1, "正常在用"),
    STOPPED(2, "停用"),
    MOVING(3, "移装中"),
    SCRAPPED(4, "注销报废"),
    OVERDUE(5, "超期未检"),
    PENDING_INSPECTION(6, "待检验");

    private final Integer code;
    private final String desc;

    DeviceStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
