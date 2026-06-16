package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AuditType {
    QUOTA_ALLOCATE("QUOTA_ALLOCATE", "配额分配"),
    QUOTA_ISSUE("QUOTA_ISSUE", "配额发放"),
    QUOTA_ADJUST("QUOTA_ADJUST", "配额调整"),
    QUOTA_TRANSFER("QUOTA_TRANSFER", "配额转让"),
    TRADE_LISTING("TRADE_LISTING", "挂牌交易"),
    TRADE_AGREEMENT("TRADE_AGREEMENT", "协议转让"),
    TRADE_SETTLE("TRADE_SETTLE", "交易过户"),
    SETTLEMENT_CLEAR("SETTLEMENT_CLEAR", "履约清缴"),
    SETTLEMENT_PENALTY("SETTLEMENT_PENALTY", "罚则生成"),
    EMISSION_REPORT("EMISSION_REPORT", "排放上报"),
    EMISSION_VERIFY("EMISSION_VERIFY", "排放核验");

    private final String code;
    private final String desc;
}
