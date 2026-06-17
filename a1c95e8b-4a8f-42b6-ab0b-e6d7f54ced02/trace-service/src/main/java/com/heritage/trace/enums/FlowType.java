package com.heritage.trace.enums;

import lombok.Getter;

@Getter
public enum FlowType {
    OUTBOUND("OUTBOUND", "出库"),
    TRANSFER("TRANSFER", "送修"),
    REPAIR_START("REPAIR_START", "开始修复"),
    REPAIR_COMPLETE("REPAIR_COMPLETE", "修复完成"),
    INBOUND("INBOUND", "入库"),
    LOAN_OUT("LOAN_OUT", "外借"),
    LOAN_RETURN("LOAN_RETURN", "归还"),
    DISPLAY("DISPLAY", "展出"),
    DISPLAY_END("DISPLAY_END", "展出结束"),
    DAMAGE("DAMAGE", "损坏"),
    INSPECTION("INSPECTION", "巡查"),
    OTHER("OTHER", "其他");

    private final String code;
    private final String name;

    FlowType(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
