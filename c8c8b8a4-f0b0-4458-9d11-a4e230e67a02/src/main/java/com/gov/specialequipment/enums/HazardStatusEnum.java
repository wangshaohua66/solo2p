package com.gov.specialequipment.enums;

import lombok.Getter;

@Getter
public enum HazardStatusEnum {

    PENDING(1, "待整改"),
    RECTIFYING(2, "整改中"),
    PENDING_REVIEW(3, "待复查"),
    CLOSED(4, "已闭环"),
    OVERDUE(5, "逾期未整改"),
    ESCALATED(6, "已升级督办");

    private final Integer code;
    private final String desc;

    HazardStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
