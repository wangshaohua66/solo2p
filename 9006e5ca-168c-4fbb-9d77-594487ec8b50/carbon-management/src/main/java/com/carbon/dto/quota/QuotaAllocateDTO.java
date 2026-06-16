package com.carbon.dto.quota;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class QuotaAllocateDTO {

    @NotNull(message = "企业ID不能为空")
    private Long enterpriseId;

    @NotNull(message = "配额年度不能为空")
    @Min(value = 2020, message = "配额年度不合法")
    @Max(value = 2100, message = "配额年度不合法")
    private Integer quotaYear;

    private BigDecimal historicalEmission;

    private String allocateReason;
}
