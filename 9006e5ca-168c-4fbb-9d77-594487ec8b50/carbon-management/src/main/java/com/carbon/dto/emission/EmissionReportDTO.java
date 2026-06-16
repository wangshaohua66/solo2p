package com.carbon.dto.emission;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class EmissionReportDTO {

    @NotNull(message = "企业ID不能为空")
    private Long enterpriseId;

    @NotNull(message = "报告年度不能为空")
    private Integer reportYear;

    @NotNull(message = "报告月份不能为空")
    @Min(value = 1, message = "月份不合法")
    @Max(value = 12, message = "月份不合法")
    private Integer reportMonth;

    @NotNull(message = "排放量不能为空")
    @DecimalMin(value = "0", message = "排放量不能为负")
    private BigDecimal emissionAmount;

    private BigDecimal co2Amount;
    private BigDecimal ch4Amount;
    private BigDecimal n2oAmount;

    @NotBlank(message = "燃料类型不能为空")
    private String fuelType;

    @DecimalMin(value = "0", message = "燃料消耗量不能为负")
    private BigDecimal fuelConsumption;

    @DecimalMin(value = "0", message = "电力消耗量不能为负")
    private BigDecimal powerConsumption;

    @DecimalMin(value = "0", message = "热力消耗量不能为负")
    private BigDecimal heatConsumption;

    @NotBlank(message = "报告格式不能为空")
    @Pattern(regexp = "JSON|XML", message = "报告格式仅支持JSON或XML")
    private String reportFormat;
}
