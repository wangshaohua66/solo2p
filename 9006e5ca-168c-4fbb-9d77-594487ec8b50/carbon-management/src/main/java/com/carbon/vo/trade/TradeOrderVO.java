package com.carbon.vo.trade;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TradeOrderVO {

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
    private LocalDateTime createdTime;
}
