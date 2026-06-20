package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum VehicleStatus {

    IDLE("空闲"),
    ASSIGNED("已派单"),
    LOADED("已装载"),
    TRANSFERRING("运输中"),
    ARRIVED("已到达"),
    MAINTENANCE("维护中");

    private final String desc;
}
