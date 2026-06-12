package com.carbon.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AccountingStandard {

    ISO_14064_1("ISO_14064_1", "ISO 14064-1:2018 组织层面"),
    GHG_PROTOCOL("GHG_PROTOCOL", "GHG Protocol 企业核算与报告标准"),
    CBAM("CBAM", "欧盟碳边境调节机制过渡报告"),
    CSRC_GUIDELINE("CSRC_GUIDELINE", "证监会上市公司温室气体披露指引"),
    ISSB_S2("ISSB_S2", "ISSB S2 气候相关披露"),
    CDP("CDP", "CDP气候变化问卷");

    private final String code;
    private final String name;
}
