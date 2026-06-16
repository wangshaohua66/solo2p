package com.carbon.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_emission_warning")
public class EmissionWarning implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long enterpriseId;

    private String enterpriseCode;

    private Integer warningYear;

    private BigDecimal cumulativeEmission;

    private BigDecimal quotaTotal;

    private BigDecimal emissionRatio;

    private String warningLevel;

    private Boolean sellRestricted;

    private String notifyStatus;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;
}
