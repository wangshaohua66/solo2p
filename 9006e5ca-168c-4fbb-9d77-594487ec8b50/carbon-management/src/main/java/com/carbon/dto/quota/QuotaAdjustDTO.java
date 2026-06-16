package com.carbon.dto.quota;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class QuotaAdjustDTO {

    @NotNull(message = "配额ID不能为空")
    private Long quotaId;

    @NotNull(message = "调整数量不能为空")
    @DecimalMin(value = "0.01", message = "调整数量必须大于0")
    private BigDecimal adjustAmount;

    @NotBlank(message = "调整原因不能为空")
    @Size(max = 500, message = "调整原因不超过500字")
    private String adjustReason;

    @NotBlank(message = "调整类型不能为空")
    private String adjustType;
}
