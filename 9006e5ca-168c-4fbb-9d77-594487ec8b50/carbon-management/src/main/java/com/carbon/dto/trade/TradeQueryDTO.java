package com.carbon.dto.trade;

import lombok.Data;

@Data
public class TradeQueryDTO {

    private Long sellerId;
    private Long buyerId;
    private String tradeMode;
    private String status;
    private Integer page = 1;
    private Integer size = 20;
}
