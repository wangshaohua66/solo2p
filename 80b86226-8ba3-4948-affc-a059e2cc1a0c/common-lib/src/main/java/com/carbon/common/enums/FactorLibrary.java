package com.carbon.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum FactorLibrary {

    IPCC_2006("IPCC_2006", "IPCC 2006 指南"),
    IPCC_2019("IPCC_2019", "IPCC 2019 修订"),
    MEE_2024("MEE_2024", "中国生态环境部 2024年排放因子"),
    MEE_2022("MEE_2022", "中国生态环境部 2022年排放因子"),
    CBAM_2024("CBAM_2024", "CBAM 2024 默认排放因子"),
    CBAM_2025("CBAM_2025", "CBAM 2025 默认排放因子"),
    GHG_PROTOCOL("GHG_PROTOCOL", "GHG Protocol 全球因子库"),
    CUSTOM("CUSTOM", "企业自定义因子");

    private final String code;
    private final String name;
}
