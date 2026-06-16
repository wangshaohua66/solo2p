package com.carbon.dto.settlement;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class SettlementClearDTO {

    @NotNull(message = "企业ID不能为空")
    private Long enterpriseId;

    @NotNull(message = "清缴年度不能为空")
    private Integer settlementYear;
}
