package com.tobacco.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public enum CreditLevel {

    AAA(4, "AAA", "优秀", new BigDecimal("1.3"), 90),
    A(3, "A", "良好", new BigDecimal("1.1"), 75),
    B(2, "B", "中等", new BigDecimal("0.9"), 60),
    C(1, "C", "较差", new BigDecimal("0.6"), 40),
    D(0, "D", "不合格", new BigDecimal("0.3"), 0);

    private final Integer rank;
    private final String code;
    private final String name;
    private final BigDecimal coefficient;
    private final Integer minScore;

    public static CreditLevel getByCode(String code) {
        if (code == null) return null;
        for (CreditLevel level : values()) {
            if (level.getCode().equals(code)) {
                return level;
            }
        }
        return null;
    }

    public static CreditLevel getByScore(Integer score) {
        if (score == null) return D;
        for (CreditLevel level : values()) {
            if (score >= level.getMinScore()) {
                return level;
            }
        }
        return D;
    }
}
