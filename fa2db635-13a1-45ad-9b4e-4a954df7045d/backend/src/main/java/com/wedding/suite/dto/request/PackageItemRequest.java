package com.wedding.suite.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PackageItemRequest {
    private Long id;
    @NotBlank(message = "项目名称不能为空")
    private String name;
    @NotBlank(message = "项目类型不能为空")
    private String type;
    @NotNull(message = "成本不能为空")
    private java.math.BigDecimal cost;
    @NotNull(message = "售价不能为空")
    private java.math.BigDecimal price;
    @NotNull(message = "是否包含不能为空")
    private Boolean included;
}
