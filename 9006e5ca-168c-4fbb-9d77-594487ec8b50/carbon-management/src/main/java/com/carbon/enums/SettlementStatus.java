package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum SettlementStatus {
    PENDING("PENDING", "待清缴"),
    CLEARED("CLEARED", "已清缴"),
    DEFICIT("DEFICIT", "配额缺口"),
    PENALTY("PENALTY", "已生成罚单"),
    INSTALLMENT("INSTALLMENT", "分期缴纳中");

    private final String code;
    private final String desc;
}
