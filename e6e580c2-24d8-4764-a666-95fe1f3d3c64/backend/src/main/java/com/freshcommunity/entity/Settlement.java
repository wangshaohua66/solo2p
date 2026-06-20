package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("settlement")
public class Settlement implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String settlementNo;

    private Integer type;

    private Long targetId;

    private String targetName;

    private LocalDate startDate;

    private LocalDate endDate;

    private BigDecimal totalAmount;

    private Integer orderCount;

    private BigDecimal commissionAmount;

    private BigDecimal platformProfit;

    private BigDecimal settleAmount;

    private Integer status;

    private LocalDateTime settleTime;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
