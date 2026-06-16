package com.carbon.vo.settlement;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class SettlementVO {

    private Long id;
    private Long enterpriseId;
    private String enterpriseCode;
    private Integer settlementYear;
    private BigDecimal quotaBalance;
    private BigDecimal actualEmission;
    private BigDecimal deficit;
    private BigDecimal surplus;
    private String status;
    private BigDecimal penaltyAmount;
    private String penaltyRule;
    private Boolean installmentAllowed;
    private Integer installmentPeriods;
    private BigDecimal installmentPaid;
    private String operator;
    private LocalDateTime settledTime;
    private LocalDateTime createdTime;
}
