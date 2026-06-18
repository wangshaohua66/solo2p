package com.wedding.suite.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StoreSaveRequest {
    private Long id;

    @NotBlank(message = "门店名称不能为空")
    private String name;

    @DecimalMin(value = "0.50", message = "折扣系数不能低于0.50")
    @DecimalMax(value = "1.00", message = "折扣系数不能超过1.00")
    private BigDecimal discountCoefficient;
}
