package com.wedding.suite.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class PackageSaveRequest {
    private Long id;

    @NotBlank(message = "套餐名称不能为空")
    private String name;

    @DecimalMin(value = "0.0", message = "基础价格不能为负")
    private java.math.BigDecimal basePrice;

    private String description;

    @NotEmpty(message = "服务项不能为空")
    @Valid
    private List<PackageItemRequest> items;
}
