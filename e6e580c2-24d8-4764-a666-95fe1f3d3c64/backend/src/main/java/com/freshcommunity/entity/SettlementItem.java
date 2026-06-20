package com.freshcommunity.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("settlement_item")
public class SettlementItem implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long settlementId;

    private Long orderId;

    private String orderNo;

    private Long productId;

    private String productName;

    private BigDecimal amount;

    private BigDecimal commission;

    private BigDecimal profit;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}
