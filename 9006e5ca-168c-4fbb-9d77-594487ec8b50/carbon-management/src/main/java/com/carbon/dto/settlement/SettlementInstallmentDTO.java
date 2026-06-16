package com.carbon.dto.settlement;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class SettlementInstallmentDTO {

    @NotNull(message = "结算ID不能为空")
    private Long settlementId;

    @NotNull(message = "申请分期期数不能为空")
    @Min(value = 2, message = "分期至少2期")
    @Max(value = 12, message = "分期最多12期")
    private Integer installmentPeriods;
}
