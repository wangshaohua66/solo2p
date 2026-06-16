package com.carbon.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_emission_report")
public class EmissionReport implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
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

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;
}
