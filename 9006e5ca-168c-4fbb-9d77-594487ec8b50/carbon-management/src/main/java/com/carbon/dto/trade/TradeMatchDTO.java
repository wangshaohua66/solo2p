package com.carbon.dto.trade;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class TradeMatchDTO {

    @NotNull(message = "买方企业ID不能为空")
    private Long buyerId;

    @NotNull(message = "挂牌订单ID不能为空")
    private Long listingOrderId;
}
