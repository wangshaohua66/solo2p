package com.carbon.vo.quota;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class QuotaVO {

    private Long id;
    private Long enterpriseId;
    private String enterpriseCode;
    private Integer quotaYear;
    private BigDecimal totalAmount;
    private BigDecimal usedAmount;
    private BigDecimal frozenAmount;
    private BigDecimal availableAmount;
    private String status;
    private BigDecimal historicalEmission;
    private BigDecimal baselineValue;
    private String allocateReason;
    private LocalDateTime createdTime;
    private LocalDateTime updatedTime;
}
