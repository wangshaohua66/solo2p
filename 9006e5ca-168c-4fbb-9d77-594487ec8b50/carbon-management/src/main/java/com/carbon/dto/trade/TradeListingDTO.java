package com.carbon.dto.trade;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TradeListingDTO {

    @NotNull(message = "卖方企业ID不能为空")
    private Long sellerId;

    @NotNull(message = "挂售数量不能为空")
    @DecimalMin(value = "1", message = "挂售数量至少为1")
    private BigDecimal amount;

    @NotNull(message = "挂售单价不能为空")
    @DecimalMin(value = "0.01", message = "挂售单价必须大于0")
    private BigDecimal unitPrice;
}
