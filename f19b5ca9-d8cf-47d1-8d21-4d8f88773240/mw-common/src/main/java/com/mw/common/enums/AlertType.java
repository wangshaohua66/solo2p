package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AlertType {

    STORAGE_TIMEOUT("暂存超时", "废物暂存超过48小时"),
    WEIGHT_DIFFERENCE("重量差异", "收运重量与登记重量差异超过5%"),
    ROUTE_DEVIATION("轨迹偏离", "车辆偏离规划路线超过2公里"),
    DISPOSAL_UNQUALIFIED("处置不达标", "处置温度/压力/时长不满足工艺要求"),
    STORAGE_MIXING("混装混放", "废物类别混装"),
    TRANSFER_TIMEOUT("转运超时", "运输时长超出预期");

    private final String name;
    private final String desc;
}
