package com.carbon.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_quota")
public class Quota implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
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

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;

    @Version
    private Integer version;
}
