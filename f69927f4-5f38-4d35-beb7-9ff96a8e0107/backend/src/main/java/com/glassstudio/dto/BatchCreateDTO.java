package com.glassstudio.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchCreateDTO {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    private Long supplierId;

    @NotBlank(message = "材料名称不能为空")
    private String materialName;

    @DecimalMin(value = "0", message = "数量不能为负数")
    private BigDecimal quantity;

    @NotBlank(message = "单位不能为空")
    private String unit;

    private LocalDate expiryDate;

    private Map<String, BigDecimal> oxideComposition;

    private String spectralData;
}
