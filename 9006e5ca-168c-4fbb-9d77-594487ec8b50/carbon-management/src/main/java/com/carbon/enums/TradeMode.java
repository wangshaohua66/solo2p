package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum TradeMode {
    LISTING("LISTING", "挂牌交易"),
    AGREEMENT("AGREEMENT", "协议转让");

    private final String code;
    private final String desc;
}
