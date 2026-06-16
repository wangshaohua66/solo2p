package com.carbon.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum EmissionStatus {
    PENDING("PENDING", "待核验"),
    VERIFIED("VERIFIED", "已核验"),
    REJECTED("REJECTED", "已驳回"),
    ANOMALY("ANOMALY", "异常待核验");

    private final String code;
    private final String desc;
}
