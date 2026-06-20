package com.tobacco.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ViolationType {

    UNLICENSED_OPERATION(1, "无证经营", 20, "high"),
    BEYOND_SCOPE(2, "超范围经营", 10, "medium"),
    COUNTERFEIT_CIGARETTES(3, "销售假冒卷烟", 25, "high"),
    NO_PRICE_TAG(4, "未明码标价", 5, "low"),
    PRICE_CHEATING(5, "价格欺诈", 15, "medium"),
    ILLEGAL_CHANNEL(6, "非法渠道进货", 18, "high"),
    UNDERAGE_SALE(7, "向未成年人销售", 20, "high"),
    OTHER(8, "其他违规", 5, "low");

    private final Integer code;
    private final String name;
    private final Integer deductPoints;
    private final String severity;

    public static ViolationType getByCode(Integer code) {
        if (code == null) return null;
        for (ViolationType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }
}
