package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum DeviceTypeEnum {

    ELEVATOR(1, "电梯"),
    CRANE(2, "起重机械"),
    PRESSURE_VESSEL(3, "压力容器"),
    BOILER(4, "锅炉"),
    ROPEWAY(5, "客运索道"),
    AMUSEMENT(6, "大型游乐设施");

    private final Integer code;
    private final String desc;

    DeviceTypeEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static DeviceTypeEnum getByCode(Integer code) {
        if (code == null) return null;
        for (DeviceTypeEnum e : values()) {
            if (e.getCode().equals(code)) return e;
        }
        return null;
    }
}
