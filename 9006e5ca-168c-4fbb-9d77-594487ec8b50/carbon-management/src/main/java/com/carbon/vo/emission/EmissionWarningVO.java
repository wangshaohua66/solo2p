package com.carbon.vo.emission;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class EmissionWarningVO {

    private Long enterpriseId;
    private String enterpriseCode;
    private Integer warningYear;
    private BigDecimal cumulativeEmission;
    private BigDecimal quotaTotal;
    private BigDecimal emissionRatio;
    private String warningLevel;
    private Boolean sellRestricted;
}
