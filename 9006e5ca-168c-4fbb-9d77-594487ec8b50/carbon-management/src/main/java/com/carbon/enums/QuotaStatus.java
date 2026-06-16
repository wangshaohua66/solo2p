package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum QuotaStatus {
    PRE_ALLOCATED("PRE_ALLOCATED", "预分配"),
    ISSUED("ISSUED", "正式发放"),
    ADJUSTED("ADJUSTED", "调整回收");

    private final String code;
    private final String desc;
}
