package com.carbon.vo.emission;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class EmissionReportVO {

    private Long id;
    private Long enterpriseId;
    private String enterpriseCode;
    private Integer reportYear;
    private Integer reportMonth;
    private BigDecimal emissionAmount;
    private BigDecimal co2Amount;
    private BigDecimal ch4Amount;
    private BigDecimal n2oAmount;
    private String fuelType;
    private BigDecimal fuelConsumption;
    private BigDecimal powerConsumption;
    private BigDecimal heatConsumption;
    private String reportFormat;
    private String status;
    private String verifyRemark;
    private String verifier;
    private LocalDateTime verifyTime;
    private LocalDateTime createdTime;
}
