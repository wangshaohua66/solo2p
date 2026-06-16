package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum TradeStatus {
    PENDING("PENDING", "待成交"),
    FROZEN("FROZEN", "配额已冻结"),
    MATCHED("MATCHED", "已撮合"),
    SETTLED("SETTLED", "已过户"),
    CANCELLED("CANCELLED", "已撤单");

    private final String code;
    private final String desc;
}
