package com.carbon.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_settlement")
public class Settlement implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
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

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;
}
