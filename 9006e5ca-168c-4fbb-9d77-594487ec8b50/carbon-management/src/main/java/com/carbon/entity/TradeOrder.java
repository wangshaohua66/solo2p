package com.carbon.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_trade_order")
public class TradeOrder implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String orderNo;

    private Long sellerId;

    private String sellerCode;

    private Long buyerId;

    private String buyerCode;

    private String tradeMode;

    private BigDecimal amount;

    private BigDecimal unitPrice;

    private BigDecimal totalPrice;

    private String status;

    private LocalDateTime listedTime;

    private LocalDateTime matchedTime;

    private LocalDateTime settledTime;

    private String cancelReason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;

    @Version
    private Integer version;
}
