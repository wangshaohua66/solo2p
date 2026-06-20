package com.tobacco.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public enum CreditLevel {

    AAA(5, "AAA", "优秀", new BigDecimal("1.3"), 95),
    AA(4, "AA", "良好", new BigDecimal("1.15"), 85),
    A(3, "A", "中等", new BigDecimal("1.0"), 75),
    BBB(2, "BBB", "合格", new BigDecimal("0.85"), 65),
    BB(1, "BB", "待改进", new BigDecimal("0.7"), 55),
    B(0, "B", "较差", new BigDecimal("0.5"), 40),
    C(-1, "C", "差", new BigDecimal("0.3"), 20),
    D(-2, "D", "不合格", new BigDecimal("0.1"), 0);

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
