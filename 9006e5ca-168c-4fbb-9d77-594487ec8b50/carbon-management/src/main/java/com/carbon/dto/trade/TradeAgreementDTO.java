package com.carbon.dto.trade;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TradeAgreementDTO {

    @NotNull(message = "卖方企业ID不能为空")
    private Long sellerId;

    @NotNull(message = "买方企业ID不能为空")
    private Long buyerId;

    @NotNull(message = "转让数量不能为空")
    @DecimalMin(value = "1", message = "转让数量至少为1")
    private BigDecimal amount;

    @NotNull(message = "转让单价不能为空")
    @DecimalMin(value = "0.01", message = "转让单价必须大于0")
    private BigDecimal unitPrice;
}
